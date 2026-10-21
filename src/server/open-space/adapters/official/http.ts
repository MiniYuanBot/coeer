import { setTimeout as delay } from "node:timers/promises";
import { AdapterError, type OperationOptions } from "../adapter.js";
import { readPrivateJSON, type OfficialConfig } from "./config.js";
export const routes = {
  profile: ["POST", "head/getList.do"],
  meetingList: ["POST", "meeting/reList.do"],
  activityList: ["POST", "classroombooking/reList.do"],
  meetingSlots: ["POST", "meeting/getTimeSlot"],
  meetingDetail: ["POST", "meeting_apply/goEdit.do"],
  activityDetail: ["POST", "classroombooking/goEdit.do"],
  initialize: ["POST", "meeting/goAdd2_0.do"],
  verify: ["POST", "meeting/verify2_0"],
  create: ["POST", "meeting_apply/save.do"],
  cancel: ["POST", "meeting_apply/cancelMeeting.do"],
} as const;
export type Operation = keyof typeof routes;
export interface OfficialResponse {
  status: number;
  body: string;
  contentType: string;
  location: string | null;
}
export interface SessionHTTP {
  request(
    operation: Operation,
    query: Record<string, string>,
    form: Record<string, string>,
    options?: OperationOptions,
  ): Promise<OfficialResponse>;
}
export interface OfficialTransport {
  session(): Promise<SessionHTTP>;
  diagnostics?(): Record<string, unknown>;
  verified?(): void;
  invalidate?(code: string): void;
  resetAuthentication?(): void;
}
export type CredentialProvider = (() => Promise<Record<string, string>>) & {
  assert?: () => void;
  verified?: () => void;
  invalidate?: (code: string) => void;
  reset?: () => void;
  diagnostics?: () => Record<string, unknown>;
  response?: (
    response: Response,
    url: URL,
  ) => Promise<Record<string, string> | undefined>;
};
export function privateSessionFile(path: string): CredentialProvider {
  return async () => {
    const value = readPrivateJSON(path, 16384);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AdapterError("CONFIGURATION");
    const entries = Object.entries(value);
    if (
      !entries.length ||
      entries.some(
        ([k, v]) =>
          !["cookie", "authorization", "x-csrf-token", "x-xsrf-token"].includes(
            k.toLowerCase(),
          ) ||
          typeof v !== "string" ||
          /[\r\n]/.test(v),
      )
    )
      throw new AdapterError("CONFIGURATION");
    return Object.fromEntries(entries) as Record<string, string>;
  };
}
export class OfficialHTTP implements OfficialTransport {
  #tail: Promise<void> = Promise.resolve();
  #lastStarted = 0;
  #notBefore = 0;
  constructor(
    private config: OfficialConfig,
    private provider: CredentialProvider,
    private fetcher: typeof fetch = fetch,
  ) {}
  diagnostics() {
    return (
      this.provider.diagnostics?.() ?? { authentication: "externally_managed" }
    );
  }
  verified() {
    this.provider.verified?.();
  }
  invalidate(code: string) {
    this.provider.invalidate?.(code);
  }
  resetAuthentication() {
    this.provider.reset?.();
  }
  async session(): Promise<SessionHTTP> {
    const credentials = await this.provider();
    const headers = new Headers(credentials);
    for (const [key, value] of headers)
      if (
        !["cookie", "authorization", "x-csrf-token", "x-xsrf-token"].includes(
          key,
        ) ||
        /[\r\n]/.test(value)
      )
        throw new AdapterError("CONFIGURATION");
    // Freeze one credential generation for the entire read/write workflow.
    return {
      request: (operation, query, form, options) =>
        this.serial(
          () => this.send(headers, operation, query, form, options),
          options?.signal,
        ),
    };
  }
  private async serial<T>(
    fn: () => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const previous = this.#tail;
    let release!: () => void;
    this.#tail = new Promise<void>((r) => (release = r));
    try {
      await previous;
      if (signal?.aborted) throw new AdapterError("TIMEOUT");
      const wait =
        Math.max(
          this.#notBefore,
          this.#lastStarted + this.config.minIntervalMs,
        ) - Date.now();
      if (wait > 0) await delay(wait, undefined, { signal });
      this.#lastStarted = Date.now();
      return await fn();
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError(signal?.aborted ? "TIMEOUT" : "NETWORK");
    } finally {
      release();
    }
  }
  private async send(
    credentials: Headers,
    operation: Operation,
    query: Record<string, string>,
    form: Record<string, string>,
    options?: OperationOptions,
  ): Promise<OfficialResponse> {
    const [method, path] = routes[operation],
      url = new URL(path, this.config.baseURL);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    if (url.origin !== new URL(this.config.baseURL).origin)
      throw new AdapterError("CONFIGURATION");
    const headers = new Headers(credentials);
    headers.set(
      "Content-Type",
      "application/x-www-form-urlencoded;charset=UTF-8",
    );
    headers.set("X-Requested-With", "XMLHttpRequest");
    headers.set("Origin", url.origin);
    headers.set("Referer", new URL("main/index", this.config.baseURL).href);
    const signal = AbortSignal.any([
      ...(options?.signal ? [options.signal] : []),
      AbortSignal.timeout(this.config.requestTimeoutMs),
    ]);
    try {
      if (signal.aborted) throw new AdapterError("TIMEOUT");
      this.provider.assert?.();
      options?.beforeSend?.();
      const r = await this.fetcher(url, {
        method,
        headers,
        body: new URLSearchParams(form),
        redirect: "manual",
        signal,
      });
      if (r.status === 401) throw new AdapterError("AUTH_EXPIRED");
      if (r.status === 403) throw new AdapterError("FORBIDDEN");
      if ([429, 502, 503].includes(r.status)) {
        const retry = r.headers.get("retry-after"),
          seconds = retry && /^\d+$/.test(retry) ? Number(retry) : null,
          duration =
            seconds === null
              ? retry
                ? Date.parse(retry) - Date.now()
                : 60000
              : seconds * 1000;
        this.#notBefore =
          Date.now() +
          Math.min(
            3600000,
            Math.max(1000, Number.isFinite(duration) ? duration : 60000),
          );
      }
      if (r.status === 429) throw new AdapterError("RATE_LIMITED");
      if (r.status === 503 || r.status === 502)
        throw new AdapterError("MAINTENANCE");
      const location = r.headers.get("location");
      if (r.status >= 300 && r.status < 400) {
        if (!location) throw new AdapterError("INVALID_RESPONSE");
        const target = new URL(location, url);
        if (
          target.origin !== url.origin ||
          /login|cas|sso|auth/i.test(target.pathname)
        )
          throw new AdapterError("AUTH_EXPIRED");
        // Never replay a POST or forward credentials through redirects.
        if (operation !== "create" && operation !== "cancel")
          throw new AdapterError("INVALID_RESPONSE");
      } else if (r.status < 200 || r.status >= 300)
        throw new AdapterError("INVALID_RESPONSE");
      const reader = r.body?.getReader();
      if (!reader) throw new AdapterError("INVALID_RESPONSE");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 2097152) {
            await reader.cancel();
            throw new AdapterError("INVALID_RESPONSE");
          }
          chunks.push(part.value);
        }
      } finally {
        reader.releaseLock();
      }
      const joined = new Uint8Array(bytes);
      let offset = 0;
      for (const c of chunks) {
        joined.set(c, offset);
        offset += c.length;
      }
      // The observed JSON endpoint incorrectly declares Latin-1. Try UTF-8 first.
      let body = new TextDecoder("utf-8", { fatal: false }).decode(joined);
      if (
        body.includes("\uFFFD") &&
        /charset\s*=\s*(?:gbk|gb2312|gb18030)/i.test(
          r.headers.get("content-type") ?? "",
        )
      )
        body = new TextDecoder("gb18030").decode(joined);
      if (
        /<input[^>]+type\s*=\s*["']?password/i.test(body) ||
        /(?:window\.)?location(?:\.href)?[^\n]*(?:login|iaaa|oauth|sso)/i.test(
          body,
        ) ||
        /<meta[^>]+http-equiv=["']?refresh[^>]*(?:login|oauth|sso)/i.test(body)
      )
        throw new AdapterError("AUTH_EXPIRED");
      const updated = await this.provider.response?.(r, url);
      if (updated)
        for (const [name, value] of Object.entries(updated))
          credentials.set(name, value);
      return {
        status: r.status,
        body,
        contentType: r.headers.get("content-type") ?? "",
        location,
      };
    } catch (e) {
      const error =
        e instanceof AdapterError
          ? e
          : new AdapterError(signal.aborted ? "TIMEOUT" : "NETWORK");
      this.provider.invalidate?.(error.code);
      throw error;
    }
  }
}
