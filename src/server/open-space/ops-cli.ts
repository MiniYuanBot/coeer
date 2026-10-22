import { readFileSync } from "node:fs";
import { assertBookingEnvironment } from './environment.js';
import { z } from "zod";
import {
  activateAccounts,
  exportAccountState,
  restoreAccountState,
  type AccountState,
} from "./accounts.js";
import { DB } from "./db.js";
import { backupDatabase, restoreDatabase, verifyDatabase } from "./backup.js";
import { ensureSessionKey } from "./adapters/official/session.js";
import {
  RemoteOfficialAdapter,
  connectorKey,
} from "./adapters/official/remote.js";
import { BookingService } from "./service.js";
import { activateReadOnlyAllowlist } from "./publication-operations.js";
if (process.env.BOOKING_EXTRA_ENV_FILE)
  process.loadEnvFile(process.env.BOOKING_EXTRA_ENV_FILE);
assertBookingEnvironment();
const command = process.argv[2],
  path = process.env.DATABASE_URL,
  schema = process.env.BOOKING_DB_SCHEMA || 'coeer_spaces',
  target = process.argv[3];
try {
  if (command === "keygen" && target) {
    ensureSessionKey(target);
    console.log('{"event":"ops.key_created"}');
  } else {
    if (!path || !/^postgres(?:ql)?:\/\//.test(path)) throw new Error();
    if (
      ["accounts-export", "accounts-activate", "accounts-restore"].includes(
        command,
      )
    ) {
      const db = await DB.open(path, schema);
      try {
        if (command === "accounts-export")
          process.stdout.write(JSON.stringify(await exportAccountState(db)));
        else {
          const raw = readFileSync(0, "utf8");
          if (Buffer.byteLength(raw) > 5 * 1024 * 1024) throw new Error();
          if (command === "accounts-activate") {
            const admin = z
              .strictObject({
                studentId: z.string().regex(/^[0-9]{10}$/),
                passwordHash: z.string().regex(/^[a-f0-9]{32}:[a-f0-9]{128}$/),
              })
              .parse(JSON.parse(raw));
            process.stdout.write(
              JSON.stringify(await activateAccounts(db, admin)),
            );
          } else {
            const state = JSON.parse(raw) as AccountState;
            if (
              !Array.isArray(state.users) ||
              !Array.isArray(state.accounts) ||
              !Array.isArray(state.allowlist) ||
              typeof state.loginEnabled !== "string"
            )
              throw new Error();
            await restoreAccountState(db, state);
            process.stdout.write(
              JSON.stringify({ authenticationRestored: true }),
            );
          }
        }
      } finally {
        await db.close();
      }
    } else if (command === "backup" && target)
      await backupDatabase(path, target, schema);
    else if (command === "restore" && target)
      await restoreDatabase(target, path, schema);
    else if (command === "check")
      console.log(JSON.stringify(await verifyDatabase(path, schema)));
    else if (command === "publish-allowlist") {
      if (
        process.env.BOOKING_DATA_SOURCE !== "official" ||
        process.env.CAMPUS_WRITE_ENABLED === "true" ||
        !process.env.CONNECTOR_URL ||
        !process.env.CONNECTOR_TOKEN_FILE
      )
        throw new Error();
      const adapter = new RemoteOfficialAdapter(
        process.env.CONNECTOR_URL,
        connectorKey(process.env.CONNECTOR_TOKEN_FILE),
        false,
      );
      await adapter.initialize();
      const db = await DB.open(path, schema);
      try {
        const service = new BookingService(db, adapter, adapter.defaultHorizon);
        await service.sync();
        const result = await activateReadOnlyAllowlist(service);
        await service.sync();
        console.log(JSON.stringify(result));
      } finally {
        await db.close();
      }
    } else if (command === "migrate" || command === "pause") {
      const db = await DB.open(path, schema);
      try {
        if (command === "pause")
          await db.tx(async () => {
            await db.set("paused", "true");
            await db.audit("operator", "automation.emergency_pause", "system");
          });
      } finally {
        await db.close();
      }
    } else throw new Error();
  }
  if (!command?.startsWith("accounts-"))
    console.log(JSON.stringify({ event: "ops.completed", command }));
} catch {
  console.error(
    "OPS_FAILED: check paths, permissions, version and maintenance procedure",
  );
  process.exitCode = 1;
}
