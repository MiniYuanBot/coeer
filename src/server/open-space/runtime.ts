import { z } from "zod";
import { readPrivateJSON } from "./adapters/official/config.js";
import { existsSync } from "node:fs";
import { assertBookingEnvironment } from './environment.js';
export type Environment = "mock" | "staging" | "production";
export function runtime(env: NodeJS.ProcessEnv) {
  assertBookingEnvironment(env);
  const mode = z
    .enum(["mock", "official", "official-disabled"])
    .parse(env.BOOKING_DATA_SOURCE ?? "official");
  const environment = z
    .enum(["mock", "staging", "production"])
    .parse(
      env.BOOKING_RUNTIME_ENV ?? (mode === "mock" ? "mock" : env.NODE_ENV === "production" ? "production" : "staging"),
    );
  const hardened = environment !== "mock";
  if (env.NODE_ENV === "production" && environment === "mock")
    throw new Error("NODE_ENV=production requires a deployed BOOKING_RUNTIME_ENV");
  if (hardened && env.BOOKING_DEMO_DATA === "true")
    throw new Error("Deployed environments forbid demo accounts");
  if (environment === "mock" && mode === "official")
    throw new Error(
      "Official access requires explicit BOOKING_RUNTIME_ENV=staging or production",
    );
  const origin = new URL(env.BOOKING_ALLOWED_ORIGIN ?? "http://localhost:5173");
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    (hardened && origin.protocol !== "https:" && !(environment === "staging" && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))
  )
    throw new Error(
      "Deployed environments require an explicit HTTPS BOOKING_ALLOWED_ORIGIN",
    );
  if (!env.DATABASE_URL || !/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL))
    throw new Error("Reservations require a PostgreSQL DATABASE_URL");
  const port = Number(env.PORT ?? 3001);
  if (env.BOOKING_ADVANCE_DAYS !== undefined)
    z.coerce.number().int().min(1).max(366).parse(env.BOOKING_ADVANCE_DAYS);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  for (const name of [
    "BOOKING_DEMO_DATA",
    "BOOKING_SYNC_ENABLED",
    "BOOKING_SUBMISSIONS_ENABLED",
    "CAMPUS_WRITE_ENABLED",
    "BOOKING_TRUST_PROXY",
    "BOOKING_PUBLIC_SIGNUP_ENABLED",
    "CAMPUS_ALLOW_INTERACTIVE_LOGIN",
    "CAMPUS_AUTO_RELOGIN",
    "CAMPUS_COOKIE_LEASE_RENEWAL",
    "CAMPUS_ALLOW_HTTP",
  ])
    if (env[name] !== undefined && !["true", "false"].includes(env[name]!))
      throw new Error(`Invalid boolean: ${name}`);
  let adminPassword = env.BOOKING_BOOTSTRAP_PASSWORD;
  if (env.BOOKING_BOOTSTRAP_FILE && existsSync(env.BOOKING_BOOTSTRAP_FILE)) {
    const parsed = z
      .strictObject({ password: z.string().min(12).max(128) })
      .safeParse(readPrivateJSON(env.BOOKING_BOOTSTRAP_FILE, 4096));
    if (!parsed.success) throw new Error("Invalid admin bootstrap file");
    adminPassword = parsed.data.password;
  }
  if (hardened && env.BOOKING_BOOTSTRAP_PASSWORD)
    throw new Error(
      "Use private BOOKING_BOOTSTRAP_FILE in deployed environments",
    );
  return {
    environment,
    mode,
    hardened,
    port,
    origin: origin.origin,
    adminPassword,
    registrationEnabled:
      env.BOOKING_PUBLIC_SIGNUP_ENABLED === "true" ||
      (!hardened && env.BOOKING_PUBLIC_SIGNUP_ENABLED !== "false"),
  };
}
