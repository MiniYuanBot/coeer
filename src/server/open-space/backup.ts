import { backup, DatabaseSync } from "node:sqlite";
import { existsSync, chmodSync, renameSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { privateTarget } from "./adapters/official/session.js";
import { DB } from "./db.js";
export function verifyDatabase(path: string) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    if (
      db.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok" ||
      db.prepare("PRAGMA foreign_key_check").all().length
    )
      throw new Error("DATABASE_INTEGRITY_FAILED");
    const version = db
      .prepare("SELECT MAX(version) AS version FROM schema_version")
      .get()?.version;
    if (typeof version !== "number" || version > 3)
      throw new Error("DATABASE_VERSION_UNSUPPORTED");
    return { integrity: "ok", version };
  } finally {
    db.close();
  }
}
export async function backupDatabase(source: string, destination: string) {
  if (!existsSync(source) || existsSync(destination))
    throw new Error("BACKUP_PATH_INVALID");
  privateTarget(destination);
  const temp = `${destination}.${randomUUID()}.tmp`,
    db = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(db, temp);
    if (process.platform !== "win32") chmodSync(temp, 0o600);
    verifyDatabase(temp);
    renameSync(temp, destination);
  } finally {
    db.close();
    rmSync(temp, { force: true });
  }
}
export async function restoreDatabase(source: string, destination: string) {
  verifyDatabase(source);
  await backupDatabase(source, destination);
  const db = new DB(destination);
  try {
    db.tx(() => {
      // A backup can predate official writes. NEVER replay its queued mutations.
      db.set("paused", "true");
      db.set("booking_enabled", "false");
      db.set("sync_enabled", "false");
      db.run("DELETE FROM booking_access");
      db.run(
        "UPDATE jobs SET state='failed',error_code='RESTORED_BACKUP',finished_at=? WHERE state IN ('running','pending')",
        Date.now(),
      );
      db.run(
        "INSERT INTO booking_events(booking_id,status,message,at) SELECT id,'manual_review','备份已恢复，须按官方记录人工核对；不会重放写入',? FROM bookings WHERE status NOT IN ('cancelled','failed')",
        Date.now(),
      );
      db.run(
        "UPDATE bookings SET status='manual_review',message='备份已恢复，须按官方记录人工核对；不会重放写入',updated_at=? WHERE status NOT IN ('cancelled','failed')",
        Date.now(),
      );
      db.audit("operator", "database.restored", "system");
    });
  } finally {
    db.close();
  }
}
