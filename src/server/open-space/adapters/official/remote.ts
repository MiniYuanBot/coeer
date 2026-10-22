import { timingSafeEqual } from "node:crypto";
import express from "express";
import { z } from "zod";
import {
  AdapterError,
  type OfficialAdapter,
  type OperationOptions,
  type CreateCommand,
  type OfficialRecord,
  type SourceSpace,
  type Snapshot,
  type PublicationGrant,
} from "../adapter.js";
import { readPrivateJSON, publication } from "./config.js";
import type { LiveOfficialAdapter } from "./live.js";
import { spaceKey } from "./parsers.js";
export function connectorKey(path: string) {
  const result = z
    .strictObject({ key: z.string() })
    .safeParse(readPrivateJSON(path, 1024));
  if (!result.success || Buffer.from(result.data.key, "base64").length !== 32)
    throw new AdapterError("CONFIGURATION");
  return result.data.key;
}
const identifier = z.string().min(1).max(128);
const commandSchema = z.strictObject({
  requestId: identifier,
  spaceId: identifier,
  module: z.literal("meeting"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(1).max(1440),
  quantity: z.literal(1),
  externalUserId: identifier,
  purpose: z.string().min(2).max(200),
});
const callSchema = z.discriminatedUnion("method", [
  z.strictObject({
    method: z.enum(["info", "listSpaces", "beginSync", "checkConnection"]),
  }),
  z.strictObject({
    method: z.literal("availability"),
    spaceId: identifier,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.strictObject({ method: z.literal("create"), command: commandSchema }),
  z.strictObject({ method: z.enum(["cancel", "get"]), ref: identifier }),
  z.strictObject({
    method: z.literal("attachReference"),
    command: commandSchema,
    ref: identifier,
  }),
]);
/** Private RPC surface: closed business operations only; never arbitrary HTTP/profile/login. */
export function createConnectorApp(
  adapter: LiveOfficialAdapter,
  secret: string,
  authentication?: { beforeRead(options?: OperationOptions): Promise<void>; diagnostics(): Record<string, unknown> },
) {
  const app = express();
  app.disable("x-powered-by");
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use((req, res, next) => {
    const provided = Buffer.from(req.headers.authorization ?? ""),
      expected = Buffer.from(`Bearer ${secret}`);
    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  let tail = Promise.resolve(),
    queued = 0;
  app.post("/rpc", async (req, res) => {
    const parsed = callSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "INVALID_RESPONSE" });
      return;
    }
    if (queued >= 20) {
      res.status(429).json({ error: "RATE_LIMITED" });
      return;
    }
    queued++;
    const previous = tail;
    let release!: () => void;
    tail = new Promise<void>((r) => (release = r));
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableFinished) controller.abort();
    });
    try {
      await previous;
      if (controller.signal.aborted) throw new AdapterError("TIMEOUT");
      const c = parsed.data,
        options = {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(adapter.operationTimeoutMs),
          ]),
        };
      let data: unknown = null;
      if (["beginSync", "checkConnection", "get"].includes(c.method))
        await authentication?.beforeRead(options);
      switch (c.method) {
        case "info":
          break;
        case "beginSync":
          adapter.beginSync();
          break;
        case "listSpaces":
          data = await adapter.listSpaces(options);
          break;
        case "availability":
          data = await adapter.availability(c.spaceId, c.date, options);
          break;
        case "create":
          data = await adapter.create(c.command, options);
          break;
        case "cancel":
          await adapter.cancel(c.ref, options);
          break;
        case "get":
          data = await adapter.get(c.ref, options);
          break;
        case "checkConnection":
          data = await adapter.checkConnection(options);
          break;
        case "attachReference":
          await adapter.attachReference(c.command, c.ref, options);
          break;
      }
      res.json({
        data,
        diagnostics: { ...adapter.diagnostics(), authenticationRecovery: authentication?.diagnostics() },
        publications: adapter.publicationGrants(),
        settings: {
          operationTimeoutMs: adapter.operationTimeoutMs,
          syncIntervalMs: adapter.syncIntervalMs,
          reconcileIntervalMs: adapter.reconcileIntervalMs,
          defaultHorizon: adapter.defaultHorizon,
          catalogComplete: adapter.catalogComplete,
          rulesSource: adapter.rulesSource,
        },
      });
    } catch (e) {
      const error =
        e instanceof AdapterError ? e : new AdapterError("INVALID_RESPONSE");
      res
        .status(502)
        .json({
          error: error.code,
          ref: error.ref,
          diagnostics: { ...adapter.diagnostics(), authenticationRecovery: authentication?.diagnostics() },
        });
    } finally {
      queued--;
      release();
    }
  });
  app.use((_req, res) => res.status(404).json({ error: "UNSUPPORTED" }));
  app.use(
    (
      _error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => res.status(400).json({ error: "INVALID_RESPONSE" }),
  );
  return app;
}
const errorCode = z.enum([
  "CONFLICT",
  "TIMEOUT",
  "NETWORK",
  "AUTH_EXPIRED",
  "UNSUPPORTED",
  "INVALID_RESPONSE",
  "FORBIDDEN",
  "RULE_REJECTED",
  "RATE_LIMITED",
  "MAINTENANCE",
  "CONFIGURATION",
  "AUTHORIZATION_REQUIRED",
]);
export class RemoteOfficialAdapter implements OfficialAdapter {
  readonly mode = "official" as const;
  operationTimeoutMs = 120000;
  syncIntervalMs = 300000;
  reconcileIntervalMs = 60000;
  defaultHorizon = 7;
  catalogComplete = false;
  rulesSource: "upstream" | "contract" = "contract";
  #diagnostics: Record<string, unknown> = {
    writeConfigured: false,
    connector: { authentication: "unchecked" },
  };
  #publications: PublicationGrant[] = [];
  #begin = false;
  constructor(
    private url: string,
    private secret: string,
    private writesGate = false,
  ) {
    const u = new URL(url);
    if (
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      u.pathname !== "/" ||
      !["http:", "https:"].includes(u.protocol)
    )
      throw new AdapterError("CONFIGURATION");
  }
  initialize() {
    return this.call({ method: "info" });
  }
  beginSync() {
    this.#begin = true;
  }
  diagnostics() {
    return {
      ...this.#diagnostics,
      writeConfigured:
        this.writesGate && this.#diagnostics.writeConfigured === true,
      transport: "isolated_connector",
    };
  }
  checkCreate(command: CreateCommand) {
    if (command.module !== "meeting") throw new AdapterError("UNSUPPORTED");
    if (!this.diagnostics().writeConfigured)
      throw new AdapterError("AUTHORIZATION_REQUIRED");
  }
  publication(spaceId: string) {
    return this.#publications.find(
      (p) =>
        (this.rulesSource === "upstream" || Date.parse(p.expiresAt) > Date.now()) &&
        spaceId === spaceKey(p.module, p.officialId),
    );
  }
  async listSpaces(options?: OperationOptions): Promise<SourceSpace[]> {
    if (this.#begin) {
      await this.call({ method: "beginSync" }, options);
      this.#begin = false;
    }
    return this.call({ method: "listSpaces" }, options);
  }
  availability(
    spaceId: string,
    date: string,
    options?: OperationOptions,
  ): Promise<Snapshot> {
    return this.call({ method: "availability", spaceId, date }, options);
  }
  create(
    command: CreateCommand,
    options?: OperationOptions,
  ): Promise<{ ref: string }> {
    this.checkCreate(command);
    return this.call({ method: "create", command }, options);
  }
  cancel(ref: string, options?: OperationOptions): Promise<void> {
    if (!this.diagnostics().writeConfigured)
      throw new AdapterError("AUTHORIZATION_REQUIRED");
    return this.call({ method: "cancel", ref }, options);
  }
  get(ref: string, options?: OperationOptions): Promise<OfficialRecord | null> {
    return this.call({ method: "get", ref }, options);
  }
  checkConnection(options?: OperationOptions) {
    return this.call<Record<string, unknown>>(
      { method: "checkConnection" },
      options,
    );
  }
  attachReference(
    command: CreateCommand,
    ref: string,
    options?: OperationOptions,
  ): Promise<void> {
    return this.call({ method: "attachReference", command, ref }, options);
  }
  private async call<T>(body: unknown, options?: OperationOptions): Promise<T> {
    const signal = AbortSignal.any([
      ...(options?.signal ? [options.signal] : []),
      AbortSignal.timeout(this.operationTimeoutMs + 1000),
    ]);
    try {
      const r = await fetch(new URL("rpc", this.url), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.secret}`,
        },
        body: JSON.stringify(body),
        redirect: "error",
        signal,
      });
      const raw = await r.text();
      if (raw.length > 2097152) throw new AdapterError("INVALID_RESPONSE");
      const result = z
        .object({
          data: z.unknown().optional(),
          error: errorCode.optional(),
          ref: z.string().optional(),
          diagnostics: z.record(z.string(), z.unknown()).optional(),
          publications: z.array(publication).optional(),
          settings: z
            .object({
              operationTimeoutMs: z.number().int().min(1000).max(300000),
              syncIntervalMs: z.number().int().min(60000),
              reconcileIntervalMs: z.number().int().min(10000),
              defaultHorizon: z.number().int().min(0).max(30),
              catalogComplete: z.boolean(),
              rulesSource: z.enum(["upstream", "contract"]).default("contract"),
            })
            .optional(),
        })
        .parse(JSON.parse(raw));
      if (result.diagnostics) this.#diagnostics = result.diagnostics;
      if (result.error) throw new AdapterError(result.error, result.ref);
      if (!r.ok || !result.settings || !result.publications)
        throw new AdapterError("INVALID_RESPONSE");
      Object.assign(this, result.settings);
      this.#publications = result.publications;
      return result.data as T;
    } catch (e) {
      const error =
        e instanceof AdapterError
          ? e
          : new AdapterError(signal.aborted ? "TIMEOUT" : "NETWORK");
      if (["NETWORK", "TIMEOUT"].includes(error.code))
        this.#diagnostics = {
          ...this.#diagnostics,
          connector: { authentication: "degraded", lastError: error.code },
        };
      throw error;
    }
  }
}
