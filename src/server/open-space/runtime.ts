import { z } from "zod";
import { readPrivateJSON } from "./adapters/official/config.js";
import { existsSync } from "node:fs";
export type Environment = "mock" | "staging" | "production";
export function runtime(env: NodeJS.ProcessEnv) {
  const environment = z
    .enum(["mock", "staging", "production"])
    .parse(
      env.APP_ENV ?? (env.NODE_ENV === "production" ? "production" : "mock"),
    );
  const mode = z
    .enum(["mock", "official", "official-disabled"])
    .parse(env.ADAPTER_MODE ?? "mock");
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
    (hardened && origin.protocol !== "https:")
  )
    throw new Error(
      "Deployed environments require an explicit HTTPS APP_ORIGIN",
    );
  if (hardened && (!env.DATABASE_PATH || env.DATABASE_PATH === ":memory:"))
    throw new Error("Deployed environments require a persistent DATABASE_PATH");
  const port = Number(env.PORT ?? 3001);
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
