import type { BrowserContextOptions } from "playwright-core";
import { AdapterError } from "./adapters/adapter.js";

/** Only non-secret operator settings. dotenv treats an unquoted # as a comment. */
export function serializeOperatorEnvironment(values: Record<string, string>) {
  const allowed = new Set(["CAMPUS_API_CONFIG_FILE", "CAMPUS_COOKIE_KEY_FILE", "CAMPUS_COOKIE_FILE",
    "CAMPUS_ALLOW_INTERACTIVE_LOGIN", "CAMPUS_ALLOW_HTTP", "CAMPUS_WRITE_ENABLED",
    "CAMPUS_LOGIN_PROXY_URL", "CAMPUS_LOGIN_URL", "CAMPUS_LOGIN_ORIGIN"]);
  return Object.entries(values).map(([key, value]) => {
    if (!allowed.has(key) || /[\r\n\x00]/.test(value) || value.length > 2048)
      throw new AdapterError("CONFIGURATION");
    const normalized = key.endsWith("_FILE") ? value.replaceAll("\\", "/") : value;
    return `${key}=${JSON.stringify(normalized)}`;
  }).join("\n") + "\n";
}

/** Separate the human login page from the API base, without credential URLs. */
export function operatorLoginURL(baseURL: string, value?: string, approvedOrigin?: string): string {
  if (!value) return baseURL;
  try {
    const url = new URL(value);
    const base = new URL(baseURL);
    const origin = approvedOrigin ? new URL(approvedOrigin) : base;
    if (origin.hostname !== base.hostname || origin.protocol !== base.protocol ||
        origin.username || origin.password || origin.search || origin.hash ||
        (approvedOrigin && origin.pathname !== "/") || url.origin !== origin.origin ||
        url.username || url.password || url.search ||
        (url.hash && !/^#\/[A-Za-z0-9/_-]+$/.test(url.hash)))
      throw new Error();
    return url.href;
  } catch {
    throw new AdapterError("CONFIGURATION");
  }
}

/** An operator-only SSH-forwarded proxy. Public IAAA retains end-to-end HTTPS. */
export function operatorLoginProxy(
  value: string | undefined,
  command: string | undefined,
): BrowserContextOptions["proxy"] {
  if (!value) return undefined;
  // OfficialHTTP does not use this browser proxy. Never permit a local CLI
  // probe to accidentally send official HTTP outside the protected tunnel.
  if (command !== "login") throw new AdapterError("CONFIGURATION");
  try {
    const url = new URL(value);
    if (
      url.protocol !== "http:" ||
      url.hostname !== "127.0.0.1" ||
      !url.port ||
      url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash
    ) throw new Error();
    return { server: url.origin, bypass: "iaaa.pku.edu.cn" };
  } catch {
    throw new AdapterError("CONFIGURATION");
  }
}
