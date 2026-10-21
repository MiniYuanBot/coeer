import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { existsSync, renameSync, unlinkSync } from "node:fs";
import { z } from "zod";
import { chromium } from "playwright-core";
import { AdapterError } from "../adapter.js";
import { readPrivateJSON, type OfficialConfig } from "./config.js";
import {
  atomicPrivateJSON,
  loadSession,
  ManagedSession,
  safeBusinessCookies,
  saveSession,
  type ConnectorSession,
} from "./session.js";
import { OfficialHTTP } from "./http.js";
import { object, parseJSON, text } from "./parsers.js";
import {
  loginProfile,
  loginUIStatus,
  meetingEntry,
  submitAccountForm,
} from "../../operator-account-form.js";

const credentialsSchema = z.strictObject({
  accountAlias: z.string().min(1),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(512),
});
export type AccountCredentials = z.infer<typeof credentialsSchema>;
const aad = Buffer.from("OpenSpace authorized account credentials v1");
function secretKey(path: string) {
  const value = z
    .strictObject({ key: z.string() })
    .parse(readPrivateJSON(path, 1024));
  const key = Buffer.from(value.key, "base64");
  if (key.length !== 32) throw new AdapterError("CONFIGURATION");
  return key;
}
export function saveAccountCredentials(
  path: string,
  keyPath: string,
  credentials: AccountCredentials,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secretKey(keyPath), iv);
  cipher.setAAD(aad);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(credentialsSchema.parse(credentials))),
    cipher.final(),
  ]);
  atomicPrivateJSON(path, {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  });
}
export function loadAccountCredentials(
  path: string,
  keyPath: string,
  alias: string,
): AccountCredentials {
  try {
    const e = z
      .strictObject({
        version: z.literal(1),
        iv: z.string(),
        tag: z.string(),
        data: z.string(),
      })
      .parse(readPrivateJSON(path, 8192));
    const cipher = createDecipheriv(
      "aes-256-gcm",
      secretKey(keyPath),
      Buffer.from(e.iv, "base64"),
    );
    cipher.setAAD(aad);
    cipher.setAuthTag(Buffer.from(e.tag, "base64"));
    const result = credentialsSchema.parse(
      JSON.parse(
        Buffer.concat([
          cipher.update(Buffer.from(e.data, "base64")),
          cipher.final(),
        ]).toString("utf8"),
      ),
    );
    if (
      result.accountAlias !== alias ||
      /[\r\n\x00]/.test(result.username + result.password)
    )
      throw 0;
    return result;
  } catch {
    throw new AdapterError("CONFIGURATION");
  }
}
export class ManualAuthenticationRequired extends Error {}
/** Normal observed portal UI in a brand-new context. No credential HTTP API,
 * old browser profiles, screenshots, traces, HAR, or authentication bypass. */
export async function loginAuthorizedAccount(
  config: OfficialConfig,
  credentials: AccountCredentials,
): Promise<ConnectorSession> {
  if (
    config.baseURL !== "http://smart.coe.pku.edu.cn:9091/meeting/" ||
    !config.allowHTTP ||
    credentials.accountAlias !== config.account.alias
  )
    throw new AdapterError("CONFIGURATION");
  const executablePath = process.env.OFFICIAL_BROWSER_EXECUTABLE_PATH
    || process.env.OPENSPACE_OFFICIAL_BROWSER_EXECUTABLE_PATH;
  const browser = await chromium.launch({ headless: true, executablePath });
  const timeout = setTimeout(() => void browser.close().catch(() => {}), 90000);
  try {
    const context = await browser.newContext({ acceptDownloads: false });
    context.setDefaultTimeout(10000);
    // Connect through the host's campus network. Restrict automatic login
    // to the two official business origins.
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return [
        "http://smart.coe.pku.edu.cn:8500",
        "http://smart.coe.pku.edu.cn:9091",
      ].includes(url.origin)
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    await page.goto(
      "http://smart.coe.pku.edu.cn:8500/show/#/v1702279899865050",
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );
    await page
      .locator('input[type="password"]')
      .waitFor({ state: "visible", timeout: 30000 });
    const challenge = async () => {
      const state = await loginUIStatus(page);
      const inputs = await page
        .locator("input")
        .evaluateAll((nodes) =>
          nodes.some(
            (n) =>
              /(captcha|otp|sms_code|validCode|验证码|动态码)/i.test(
                [
                  n.id,
                  n.getAttribute("name"),
                  n.getAttribute("placeholder"),
                ].join(" "),
              ) && !!(n as HTMLElement).offsetParent,
          ),
        );
      return (
        state.challengeVisible ||
        inputs ||
        state.passwordChangeRequired ||
        state.accountRejected
      );
    };
    if (await challenge()) throw new ManualAuthenticationRequired();
    await submitAccountForm(page, credentials.username, credentials.password); // Exactly one login attempt.
    await page
      .locator('input[type="password"]')
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {
        throw new ManualAuthenticationRequired();
      });
    if (await challenge()) throw new ManualAuthenticationRequired();
    let entry = await meetingEntry(context);
    for (let i = 0; !entry && i < 15; i++) {
      await page.waitForTimeout(500);
      entry = await meetingEntry(context);
    }
    if (!entry) throw new ManualAuthenticationRequired();
    await entry.click();
    for (let i = 0; i < 30; i++) {
      if (
        context.pages().some((p) =>
          p.frames().some((f) => {
            try {
              const url = new URL(f.url());
              return (
                url.origin === "http://smart.coe.pku.edu.cn:9091" &&
                url.pathname.startsWith("/meeting/")
              );
            } catch {
              return false;
            }
          }),
        )
      )
        break;
      await page.waitForTimeout(500);
    }
    const profile = await loginProfile(
      context,
      config.baseURL,
      config.requestTimeoutMs,
    );
    const json = parseJSON(profile.body);
    if (
      profile.status !== 200 ||
      !Array.isArray(json.list) ||
      json.list.length !== 1 ||
      text(object(json.list[0]).USER_ID) !== config.account.profileUserId
    )
      throw new AdapterError("FORBIDDEN");
    const cookies = safeBusinessCookies(
      await context.cookies(config.baseURL),
      new URL(config.baseURL).hostname,
    );
    if (!cookies.length) throw new AdapterError("AUTH_EXPIRED");
    const now = Date.now();
    return {
      version: 1,
      accountAlias: config.account.alias,
      revision: randomUUID(),
      issuedAt: now,
      expiresAt: now + 8 * 3600000,
      cookies,
    };
  } finally {
    clearTimeout(timeout);
    await browser.close();
  }
}
const stateSchema = z.strictObject({
  revision: z.string(),
  day: z.number(),
  attempts: z.number().int(),
  nextAttemptAt: z.number(),
  manualRequired: z.boolean(),
  lastError: z.string().nullable(),
  lastRecoveredAt: z.number().nullable(),
});
type State = z.infer<typeof stateSchema>;
/** Called inside the Connector's existing serialized RPC queue, reads only.
 * Never retries a create/cancel or clears a database/manual write pause. */
export class AuthenticationRecovery {
  constructor(
    private options: {
      config: OfficialConfig;
      sessionPath: string;
      keyPath: string;
      statePath: string;
      manager: ManagedSession;
      probe(): Promise<unknown>;
      login(): Promise<ConnectorSession>;
    },
  ) {}
  private state(): State {
    if (existsSync(this.options.statePath))
      return stateSchema.parse(readPrivateJSON(this.options.statePath, 4096));
    return {
      revision: "",
      day: Math.floor(Date.now() / 86400000),
      attempts: 0,
      nextAttemptAt: 0,
      manualRequired: false,
      lastError: null,
      lastRecoveredAt: null,
    };
  }
  diagnostics() {
    try {
      const s = this.state();
      return {
        automaticLogin: true,
        manualRequired: s.manualRequired,
        attemptsToday: s.attempts,
        nextAttemptAt: s.nextAttemptAt,
        lastError: s.lastError,
        lastRecoveredAt: s.lastRecoveredAt,
      };
    } catch {
      return {
        automaticLogin: true,
        manualRequired: true,
        lastError: "CONFIGURATION",
      };
    }
  }
  async beforeRead() {
    const o = this.options,
      state = this.state(),
      revision = loadSession(o.sessionPath, o.keyPath).revision;
    if (state.revision !== revision) {
      state.manualRequired = false;
      state.nextAttemptAt = 0;
    }
    if (state.manualRequired) throw new AdapterError("AUTH_EXPIRED");
    try {
      await o.probe();
      return;
    } catch (e) {
      if (!(e instanceof AdapterError) || e.code !== "AUTH_EXPIRED") throw e;
    }
    const now = Date.now(),
      day = Math.floor(now / 86400000);
    if (state.day !== day) {
      state.day = day;
      state.attempts = 0;
    }
    if (now < state.nextAttemptAt || state.attempts >= 3)
      throw new AdapterError("AUTH_EXPIRED");
    state.revision = revision;
    state.attempts++;
    state.nextAttemptAt = now + 15 * 60000;
    atomicPrivateJSON(o.statePath, state); // Crash/restart cannot bypass the attempt budget.
    let candidate: string | undefined;
    try {
      const session = await o.login();
      candidate = o.sessionPath + "." + randomUUID() + ".candidate";
      saveSession(candidate, o.keyPath, session);
      const manager = new ManagedSession(o.config, candidate, o.keyPath);
      const http = new OfficialHTTP(o.config, manager.provider);
      const response = await (await http.session()).request("profile", {}, {});
      const json = parseJSON(response.body);
      if (
        !Array.isArray(json.list) ||
        json.list.length !== 1 ||
        text(object(json.list[0]).USER_ID) !== o.config.account.profileUserId
      )
        throw new AdapterError("FORBIDDEN");
      renameSync(candidate, o.sessionPath);
      candidate = undefined;
      o.manager.provider.reset!();
      await o.probe();
      state.revision = session.revision;
      state.lastRecoveredAt = Date.now();
      state.lastError = null;
      state.nextAttemptAt = 0;
      atomicPrivateJSON(o.statePath, state);
    } catch (e) {
      const code =
        e instanceof AdapterError
          ? e.code
          : e instanceof ManualAuthenticationRequired
            ? "MANUAL_AUTH_REQUIRED"
            : "LOGIN_FAILED";
      state.lastError = code;
      state.manualRequired = ![
        "NETWORK",
        "TIMEOUT",
        "MAINTENANCE",
        "RATE_LIMITED",
      ].includes(code);
      atomicPrivateJSON(o.statePath, state);
      throw new AdapterError("AUTH_EXPIRED");
    } finally {
      if (candidate && existsSync(candidate)) unlinkSync(candidate);
    }
  }
}
