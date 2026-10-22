import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { isPrivateRuntimePath } from '../../private-path'
import { z } from "zod";
import { AdapterError } from "../adapter.js";
import { readPrivateJSON, type OfficialConfig } from "./config.js";
import type { CredentialProvider } from "./http.js";
const cookieSchema = z.strictObject({
  name: z.string().regex(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/),
  value: z
    .string()
    .max(8192)
    .regex(/^[\x21-\x3a\x3c-\x7e]*$/),
  domain: z.string(),
  path: z.string().startsWith("/"),
  expires: z.number(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  sameSite: z.enum(["Strict", "Lax", "None"]),
});
export const sessionSchema = z.strictObject({
  version: z.literal(1),
  accountAlias: z.string(),
  revision: z.string().uuid(),
  issuedAt: z.number(),
  expiresAt: z.number(),
  cookies: z.array(cookieSchema).min(1).max(100),
});
export type ConnectorSession = z.infer<typeof sessionSchema>;
/** Ignore unrelated browser cookies which cannot be sent as safe HTTP headers.
 * Never re-encode a cookie value; the server probe must verify the retained set.
 */
export function safeBusinessCookies(
  cookies: ConnectorSession["cookies"],
  hostname: string,
) {
  return cookies.filter(
    (cookie) =>
      cookie.domain.replace(/^\./, "") === hostname &&
      cookieSchema.safeParse(cookie).success,
  );
}
export function privateTarget(path: string) {
  try {
    path = resolve(path);
    if (!isPrivateRuntimePath(path)) throw 0;
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    const parent = realpathSync(dirname(path));
    if (!isPrivateRuntimePath(parent))
      throw 0;
    if (process.platform !== "win32" && statSync(parent).mode & 0o077) throw 0;
    // Do not follow pre-existing symlinks for private output files.
    if (
      existsSync(path) &&
      (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    )
      throw 0;
  } catch {
    throw new AdapterError("CONFIGURATION");
  }
}
export function atomicPrivateJSON(path: string, value: unknown) {
  privateTarget(path);
  const temp = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify(value), { mode: 0o600, flag: "wx" });
  renameSync(temp, path);
  if (process.platform !== "win32") chmodSync(path, 0o600);
}
function key(path: string) {
  const value = readPrivateJSON(path, 1024);
  if (
    !value ||
    typeof value !== "object" ||
    !("key" in value) ||
    typeof value.key !== "string"
  )
    throw new AdapterError("CONFIGURATION");
  const bytes = Buffer.from(value.key, "base64");
  if (bytes.length !== 32) throw new AdapterError("CONFIGURATION");
  return bytes;
}
export function ensureSessionKey(path: string) {
  if (!existsSync(path))
    atomicPrivateJSON(path, { key: randomBytes(32).toString("base64") });
  key(path);
}
export function saveSession(
  path: string,
  keyPath: string,
  session: ConnectorSession,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(keyPath), iv);
  cipher.setAAD(Buffer.from("OpenSpace official session v1"));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(sessionSchema.parse(session))),
    cipher.final(),
  ]);
  atomicPrivateJSON(path, {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}
export function loadSession(path: string, keyPath: string): ConnectorSession {
  try {
    const e = z
      .strictObject({
        version: z.literal(1),
        iv: z.string(),
        tag: z.string(),
        data: z.string(),
      })
      .parse(readPrivateJSON(path, 131072));
    const cipher = createDecipheriv(
      "aes-256-gcm",
      key(keyPath),
      Buffer.from(e.iv, "base64"),
    );
    cipher.setAAD(Buffer.from("OpenSpace official session v1"));
    cipher.setAuthTag(Buffer.from(e.tag, "base64"));
    return sessionSchema.parse(
      JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(e.data, "base64")),
          cipher.final(),
        ]).toString("utf8"),
      ),
    );
  } catch {
    throw new AdapterError("AUTH_EXPIRED");
  }
}
export class ManagedSession {
  #session?: ConnectorSession;
  #blocked = false;
  #state = "unchecked";
  #lastError: string | null = null;
  #lastSuccessAt: number | null = null;
  constructor(
    readonly config: OfficialConfig,
    private path: string,
    private keyPath: string,
    private renewVerifiedLease = false,
  ) {}
  private validate(s: ConnectorSession) {
    const base = new URL(this.config.baseURL);
    if (
      s.accountAlias !== this.config.account.alias ||
      !this.config.account.profileUserId
    )
      throw new AdapterError("CONFIGURATION");
    if (
      s.expiresAt <= Date.now() ||
      s.issuedAt > Date.now() + 60000 ||
      s.expiresAt > s.issuedAt + 86400000 ||
      s.expiresAt <= s.issuedAt
    )
      throw new AdapterError("AUTH_EXPIRED");
    if (
      s.cookies.some(
        (c) =>
          c.domain.replace(/^\./, "") !== base.hostname ||
          /[\r\n;]/.test(c.value),
      )
    )
      throw new AdapterError("CONFIGURATION");
  }
  readonly provider: CredentialProvider = Object.assign(
    async () => {
      if (this.#blocked) throw new AdapterError("AUTH_EXPIRED");
      try {
        this.#session ??= loadSession(this.path, this.keyPath);
        this.validate(this.#session);
        const url = new URL(this.config.baseURL),
          now = Date.now() / 1000;
        const cookies = this.#session.cookies.filter(
          (c) =>
            (c.expires < 0 || c.expires > now) &&
            (!c.secure || url.protocol === "https:") &&
            (c.path === "/" ||
              url.pathname.startsWith(
                c.path.endsWith("/") ? c.path : `${c.path}/`,
              ) ||
              url.pathname === c.path),
        );
        if (!cookies.length) throw new AdapterError("AUTH_EXPIRED");
        return {
          Cookie: cookies
            .sort((a, b) => b.path.length - a.path.length)
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
        };
      } catch (e) {
        this.fail(e instanceof AdapterError ? e.code : "AUTH_EXPIRED");
        throw e;
      }
    },
    {
      invalidate: (code: string) => this.fail(code),
      verified: () => {
        if (this.#blocked) throw new AdapterError("AUTH_EXPIRED");
        if (this.#session) this.validate(this.#session);
        // Extend only after the adapter has independently matched the pinned
        // official identity. This never changes the server's cookie expiry.
        if (
          this.renewVerifiedLease &&
          this.#session &&
          !this.#blocked &&
          this.#session.expiresAt > Date.now() &&
          this.#session.expiresAt - Date.now() < 4 * 3600000
        ) {
          const current = loadSession(this.path, this.keyPath);
          if (current.revision !== this.#session.revision) {
            this.fail("AUTH_EXPIRED");
            throw new AdapterError("AUTH_EXPIRED");
          }
          this.#session = {
            ...this.#session,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 8 * 3600000,
          };
          saveSession(this.path, this.keyPath, this.#session);
        }
        this.#state = "healthy";
        this.#lastError = null;
        this.#lastSuccessAt = Date.now();
      },
      reset: () => {
        this.#session = undefined;
        this.#blocked = false;
        this.#state = "unchecked";
      },
      assert: () => {
        if (
          this.#blocked ||
          (this.#session && this.#session.expiresAt <= Date.now())
        ) {
          this.fail("AUTH_EXPIRED");
          throw new AdapterError("AUTH_EXPIRED");
        }
      },
      diagnostics: () => this.diagnostics(),
      response: (response: Response, url: URL) =>
        this.updateCookies(response, url),
    },
  );
  private fail(code: string) {
    this.#lastError = code;
    if (["AUTH_EXPIRED", "FORBIDDEN", "CONFIGURATION"].includes(code)) {
      this.#blocked = true;
      this.#state = "auth_required";
    } else this.#state = "degraded";
  }
  private async updateCookies(response: Response, url: URL) {
    if (!this.#session || this.#blocked) return;
    const current = loadSession(this.path, this.keyPath);
    // An operator may have atomically replaced the session during this request.
    if (current.revision !== this.#session.revision) {
      this.fail("AUTH_EXPIRED");
      throw new AdapterError("AUTH_EXPIRED");
    }
    const host = new URL(this.config.baseURL).hostname;
    let changed = false;
    for (const raw of response.headers.getSetCookie()) {
      const parts = raw.split(";").map((v) => v.trim()),
        first = parts.shift()!,
        index = first.indexOf("=");
      if (index < 1) continue;
      const attrs = new Map(
        parts.map((p) => {
          const i = p.indexOf("=");
          return [
            p.slice(0, i < 0 ? undefined : i).toLowerCase(),
            i < 0 ? "" : p.slice(i + 1),
          ] as const;
        }),
      );
      const domain = (attrs.get("domain") ?? host).replace(/^\./, "");
      const path =
        attrs.get("path") ??
        (url.pathname.slice(0, url.pathname.lastIndexOf("/")) || "/");
      // Only cookies valid for the exact official host are retained.
      if (domain !== host || !path.startsWith("/")) continue;
      const maxAge = attrs.get("max-age"),
        expiry = attrs.get("expires");
      let expires = -1;
      if (maxAge && /^-?\d+$/.test(maxAge))
        expires = Date.now() / 1000 + Number(maxAge);
      else if (expiry && Number.isFinite(Date.parse(expiry)))
        expires = Date.parse(expiry) / 1000;
      const c = cookieSchema.safeParse({
        name: first.slice(0, index),
        value: first.slice(index + 1),
        domain,
        path,
        expires,
        secure: attrs.has("secure"),
        httpOnly: attrs.has("httponly"),
        sameSite: /^(strict|none)$/i.test(attrs.get("samesite") ?? "")
          ? attrs.get("samesite")!.toLowerCase() === "strict"
            ? "Strict"
            : "None"
          : "Lax",
      });
      if (!c.success) throw new AdapterError("INVALID_RESPONSE");
      this.#session.cookies = this.#session.cookies.filter(
        (v) => !(v.name === c.data.name && v.path === path),
      );
      if (expires < 0 || expires > Date.now() / 1000)
        this.#session.cookies.push(c.data);
      changed = true;
    }
    if (changed) {
      if (!this.#session.cookies.length) {
        this.fail("AUTH_EXPIRED");
        throw new AdapterError("AUTH_EXPIRED");
      }
      saveSession(this.path, this.keyPath, this.#session);
    }
    return this.provider();
  }
  diagnostics() {
    if (this.#session && this.#session.expiresAt <= Date.now())
      this.fail("AUTH_EXPIRED");
    return {
      authentication: this.#state,
      method: "operator_sso",
      lastSuccessAt: this.#lastSuccessAt,
      lastError: this.#lastError,
      expiresAt: this.#session?.expiresAt ?? null,
      recoveryRequired: this.#blocked,
      verifiedLeaseRenewal: this.renewVerifiedLease,
    };
  }
}
