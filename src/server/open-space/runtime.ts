import { z } from "zod";
import { readPrivateJSON } from "./adapters/official/config.js";
import { existsSync } from "node:fs";
export type Environment = "mock" | "staging" | "production";
export function runtime(env: NodeJS.ProcessEnv) {
  const mode = z
    .enum(["mock", "official", "official-disabled"])
    .parse(env.ADAPTER_MODE ?? "official");
  const environment = z
    .enum(["mock", "staging", "production"])
    .parse(
      env.APP_ENV ?? (mode === "mock" ? "mock" : env.NODE_ENV === "production" ? "production" : "staging"),
    );
  const hardened = environment !== "mock";
  if (env.NODE_ENV === "production" && environment === "mock")
    throw new Error("NODE_ENV=production requires a deployed APP_ENV");
  if (hardened && env.DEMO_MODE === "true")
    throw new Error("Deployed environments forbid demo accounts");
  if (environment === "mock" && mode === "official")
    throw new Error(
      "Official access requires explicit APP_ENV=staging or production",
    );
  const origin = new URL(env.APP_ORIGIN ?? "http://localhost:5173");
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (hardened && origin.protocol !== "https:" && !(environment === "staging" && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
  )
    throw new Error(
      "Deployed environments require an explicit HTTPS APP_ORIGIN",
    );
  if (!env.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL))
    throw new Error("Reservations require a PostgreSQL DATABASE_URL");
  const port = Number(env.PORT ?? 3001);
  if (env.BOOKING_DAYS !== undefined)
    z.coerce.number().int().min(1).max(366).parse(env.BOOKING_DAYS);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  for (const name of [
    "DEMO_MODE",
    "SYNC_ENABLED",
    "BOOKING_ENABLED",
    "OFFICIAL_WRITES_ENABLED",
    "TRUST_PROXY",
    "REGISTRATION_ENABLED",
    "OFFICIAL_OPERATOR_LOGIN_APPROVED",
    "OFFICIAL_AUTOMATIC_LOGIN_APPROVED",
    "OFFICIAL_SESSION_RENEWAL",
    "OFFICIAL_HTTP_NETWORK_APPROVED",
  ])
    if (env[name] !== undefined && !["true", "false"].includes(env[name]!))
      throw new Error(`Invalid boolean: ${name}`);
  let adminPassword = env.ADMIN_PASSWORD;
  if (env.ADMIN_BOOTSTRAP_FILE && existsSync(env.ADMIN_BOOTSTRAP_FILE)) {
    const parsed = z
      .strictObject({ password: z.string().min(12).max(128) })
      .safeParse(readPrivateJSON(env.ADMIN_BOOTSTRAP_FILE, 4096));
    if (!parsed.success) throw new Error("Invalid admin bootstrap file");
    adminPassword = parsed.data.password;
  }
  if (hardened && env.ADMIN_PASSWORD)
    throw new Error(
      "Use private ADMIN_BOOTSTRAP_FILE in deployed environments",
    );
  return {
    environment,
    mode,
    hardened,
    port,
    origin: origin.origin,
    adminPassword,
    registrationEnabled:
      env.REGISTRATION_ENABLED === "true" ||
      (!hardened && env.REGISTRATION_ENABLED !== "false"),
  };
}
