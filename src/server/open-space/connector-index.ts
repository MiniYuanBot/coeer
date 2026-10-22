/** Private network service. No external users, no automatic booking worker. */
import { AdapterError } from "./adapters/adapter.js";
import { assertBookingEnvironment } from './environment.js';
import { DB } from "./db.js";
import { loadOfficialConfig } from "./adapters/official/config.js";
import { ManagedSession } from "./adapters/official/session.js";
import { OfficialHTTP } from "./adapters/official/http.js";
import { LiveOfficialAdapter } from "./adapters/official/live.js";
import { PostgresBindings } from "./adapters/official/bindings.js";
import {
  AuthenticationRecovery,
  loadAccountCredentials,
  loginAuthorizedAccount,
} from "./adapters/official/recovery.js";
import {
  createConnectorApp,
  connectorKey,
} from "./adapters/official/remote.js";
if (process.env.BOOKING_EXTRA_ENV_FILE)
  process.loadEnvFile(process.env.BOOKING_EXTRA_ENV_FILE);
assertBookingEnvironment();
process.umask(0o077);
if (
  !process.env.CAMPUS_API_CONFIG_FILE ||
  !process.env.CAMPUS_COOKIE_FILE ||
  !process.env.CAMPUS_COOKIE_KEY_FILE ||
  !process.env.CONNECTOR_TOKEN_FILE ||
  !process.env.DATABASE_URL
)
  throw new Error("Private connector configuration required");
const cfg = loadOfficialConfig(
  process.env.CAMPUS_API_CONFIG_FILE,
  process.env.CAMPUS_PUBLIC_ROOMS_FILE,
  process.env.CAMPUS_BOOKING_FORM_FILE,
);
if (!cfg.account.profileUserId)
  throw new Error("Enroll an authorized service identity first");
if (cfg.allowHTTP && process.env.CAMPUS_ALLOW_HTTP !== "true")
  throw new Error("Protected HTTP network approval required");
cfg.writes.enabled =
  cfg.writes.enabled && process.env.CAMPUS_WRITE_ENABLED === "true";
const db = await DB.open(process.env.DATABASE_URL, process.env.BOOKING_DB_SCHEMA),
  manager = new ManagedSession(
    cfg,
    process.env.CAMPUS_COOKIE_FILE,
    process.env.CAMPUS_COOKIE_KEY_FILE,
    process.env.CAMPUS_COOKIE_LEASE_RENEWAL === "true",
  );
const adapter = new LiveOfficialAdapter(
  cfg,
  new OfficialHTTP(cfg, manager.provider),
  new PostgresBindings(db),
  async () => {
    if (
      await db.setting("paused") === "true" ||
      await db.setting("booking_enabled") !== "true"
    )
      throw new AdapterError("AUTHORIZATION_REQUIRED");
  },
);
const port = Number(process.env.CONNECTOR_LISTEN_PORT ?? 3002);
let authentication: AuthenticationRecovery | undefined;
if (process.env.CAMPUS_AUTO_RELOGIN === "true") {
  if (
    !process.env.CAMPUS_ACCOUNT_FILE ||
    !process.env.CAMPUS_ACCOUNT_KEY_FILE ||
    !process.env.CAMPUS_RELOGIN_STATE_FILE
  )
    throw new Error("Private automatic authentication configuration required");
  const credentialsPath = process.env.CAMPUS_ACCOUNT_FILE,
    credentialsKey = process.env.CAMPUS_ACCOUNT_KEY_FILE,
    keyPath = process.env.CAMPUS_COOKIE_KEY_FILE;
  authentication = new AuthenticationRecovery({
    config: cfg,
    manager,
    sessionPath: process.env.CAMPUS_COOKIE_FILE,
    keyPath,
    statePath: process.env.CAMPUS_RELOGIN_STATE_FILE,
    probe: options => adapter.checkConnection(options),
    login: () =>
      loginAuthorizedAccount(
        cfg,
        loadAccountCredentials(
          credentialsPath,
          credentialsKey,
          cfg.account.alias,
        ),
      ),
  });
}
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid connector port");
const server = createConnectorApp(
  adapter,
  connectorKey(process.env.CONNECTOR_TOKEN_FILE),
  authentication,
).listen(port, process.env.CONNECTOR_LISTEN_HOST ?? "127.0.0.1", () =>
  console.log('{"event":"connector.started"}'),
);
server.requestTimeout = 30000;
server.headersTimeout = 10000;
let closing = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    if (closing) return;
    closing = true;
    setTimeout(() => process.exit(1), 135000).unref();
    server.close(() => {
      void db.close().then(() => process.exit(0), () => process.exit(1));
    });
  });
