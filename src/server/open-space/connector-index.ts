/** Private network service. No external users, no automatic booking worker. */
import { AdapterError } from "./adapters/adapter.js";
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
if (process.env.CONFIG_ENV_FILE)
  process.loadEnvFile(process.env.CONFIG_ENV_FILE);
process.umask(0o077);
if (
  !process.env.OFFICIAL_CONFIG_FILE ||
  !process.env.OFFICIAL_SESSION_FILE ||
  !process.env.OFFICIAL_SESSION_KEY_FILE ||
  !process.env.OFFICIAL_CONNECTOR_KEY_FILE ||
  !process.env.DATABASE_URL
)
  throw new Error("Private connector configuration required");
const cfg = loadOfficialConfig(
  process.env.OFFICIAL_CONFIG_FILE,
  process.env.OFFICIAL_PUBLICATION_FILE,
  process.env.OFFICIAL_WRITES_FILE,
);
if (!cfg.account.profileUserId)
  throw new Error("Enroll an authorized service identity first");
if (cfg.allowHTTP && process.env.OFFICIAL_HTTP_NETWORK_APPROVED !== "true")
  throw new Error("Protected HTTP network approval required");
cfg.writes.enabled =
  cfg.writes.enabled && process.env.OFFICIAL_WRITES_ENABLED === "true";
const db = await DB.open(process.env.DATABASE_URL, process.env.DATABASE_SCHEMA),
  manager = new ManagedSession(
    cfg,
    process.env.OFFICIAL_SESSION_FILE,
    process.env.OFFICIAL_SESSION_KEY_FILE,
    process.env.OFFICIAL_SESSION_RENEWAL === "true",
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
const port = Number(process.env.CONNECTOR_PORT ?? 3002);
let authentication: AuthenticationRecovery | undefined;
if (process.env.OFFICIAL_AUTOMATIC_LOGIN_APPROVED === "true") {
  if (
    !process.env.OFFICIAL_ACCOUNT_CREDENTIALS_FILE ||
    !process.env.OFFICIAL_ACCOUNT_KEY_FILE ||
    !process.env.OFFICIAL_RECOVERY_STATE_FILE
  )
    throw new Error("Private automatic authentication configuration required");
  const credentialsPath = process.env.OFFICIAL_ACCOUNT_CREDENTIALS_FILE,
    credentialsKey = process.env.OFFICIAL_ACCOUNT_KEY_FILE,
    keyPath = process.env.OFFICIAL_SESSION_KEY_FILE;
  authentication = new AuthenticationRecovery({
    config: cfg,
    manager,
    sessionPath: process.env.OFFICIAL_SESSION_FILE,
    keyPath,
    statePath: process.env.OFFICIAL_RECOVERY_STATE_FILE,
    probe: () => adapter.checkConnection(),
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
  connectorKey(process.env.OFFICIAL_CONNECTOR_KEY_FILE),
  authentication,
).listen(port, process.env.CONNECTOR_HOST ?? "127.0.0.1", () =>
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
