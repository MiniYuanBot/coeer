import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class DB {
  readonly raw: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.raw = new DatabaseSync(path);
    if (
      this.raw
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'",
        )
        .get()
    ) {
      const version = this.raw
        .prepare("SELECT MAX(version) AS version FROM schema_version")
        .get() as { version: number };
      if (version.version > 3) {
        this.raw.close();
        throw new Error(
          "Database schema is newer than this application; restore a compatible release",
        );
      }
    }
    this.raw.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    this.raw.exec(`
      CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY);
      INSERT OR IGNORE INTO schema_version VALUES(1);
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','admin')));
      CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY,module TEXT NOT NULL,official_id TEXT NOT NULL,name TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL,capacity INTEGER NOT NULL,amenities TEXT NOT NULL,policy TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,bookable INTEGER NOT NULL DEFAULT 0,upstream_enabled INTEGER NOT NULL DEFAULT 1,UNIQUE(module,official_id));
      CREATE TABLE IF NOT EXISTS snapshots(space_id TEXT NOT NULL REFERENCES spaces(id),date TEXT NOT NULL,slots TEXT NOT NULL,included_refs TEXT NOT NULL,observed_at INTEGER NOT NULL,PRIMARY KEY(space_id,date));
      CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),space_id TEXT NOT NULL REFERENCES spaces(id),date TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,quantity INTEGER NOT NULL,purpose TEXT NOT NULL,status TEXT NOT NULL,message TEXT NOT NULL,official_ref TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0,idempotency_key TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,UNIQUE(user_id,idempotency_key),CHECK(start<end),CHECK(quantity>0));
      CREATE INDEX IF NOT EXISTS booking_range ON bookings(space_id,date,start,end);
      -- Compatible additive private storage; older releases ignore this table.
      CREATE TABLE IF NOT EXISTS booking_access(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,door_code TEXT NOT NULL,verified_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS booking_allowlist(student_id TEXT PRIMARY KEY CHECK(length(student_id)=10 AND student_id NOT GLOB '*[^0-9]*'),name TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS user_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),student_id TEXT UNIQUE NOT NULL CHECK(length(student_id)=10 AND student_id NOT GLOB '*[^0-9]*'),booking_permission TEXT NOT NULL CHECK(booking_permission IN ('allowed','review','blocked')),enabled INTEGER NOT NULL DEFAULT 1,password_changed_at INTEGER);
      CREATE TABLE IF NOT EXISTS booking_events(id INTEGER PRIMARY KEY AUTOINCREMENT,booking_id TEXT NOT NULL REFERENCES bookings(id),status TEXT NOT NULL,message TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,type TEXT NOT NULL,booking_id TEXT REFERENCES bookings(id),state TEXT NOT NULL DEFAULT 'pending',run_at INTEGER NOT NULL,locked_at INTEGER,attempts INTEGER NOT NULL DEFAULT 0,error_code TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS active_job ON jobs(type,COALESCE(booking_id,'')) WHERE state IN ('pending','running');
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT OR IGNORE INTO settings VALUES('paused','false');
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,error_code TEXT,snapshot_count INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS mock_reservations(ref TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,space_id TEXT NOT NULL,date TEXT NOT NULL,start INTEGER NOT NULL,end INTEGER NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS mock_scenarios(space_id TEXT PRIMARY KEY,scenario TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS adapter_calls(id INTEGER PRIMARY KEY AUTOINCREMENT,operation TEXT NOT NULL,request_id TEXT NOT NULL,at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS official_bindings(request_id TEXT PRIMARY KEY,official_ref TEXT UNIQUE NOT NULL,account_alias TEXT NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL,entity_id TEXT NOT NULL,first_at INTEGER NOT NULL,last_at INTEGER NOT NULL,occurrences INTEGER NOT NULL DEFAULT 1,ack_at INTEGER,ack_by TEXT);
      CREATE UNIQUE INDEX IF NOT EXISTS open_alert ON alerts(code,entity_id) WHERE ack_at IS NULL;
      CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until INTEGER NOT NULL);
    `);
    // Additive v1 -> v2 migration; preserve bookings, sessions and pending jobs.
    this.tx(() => {
      const add = (table: string, column: string, definition: string) => {
        if (
          !this.all<{ name: string }>(`PRAGMA table_info(${table})`).some(
            (c) => c.name === column,
          )
        )
          this.raw.exec(
            `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
          );
      };
      add("spaces", "provider", "TEXT NOT NULL DEFAULT 'mock'");
      add("spaces", "permission", "TEXT NOT NULL DEFAULT 'allowed'");
      add("spaces", "source_metadata", "TEXT NOT NULL DEFAULT '{}'");
      add("bookings", "provider", "TEXT NOT NULL DEFAULT 'mock'");
      add("bookings", "applicant_name", "TEXT");
      add("bookings", "student_id", "TEXT");
      add("bookings", "submission_user_id", "TEXT");
      add("sync_runs", "provider", "TEXT NOT NULL DEFAULT 'mock'");
      add("jobs", "finished_at", "INTEGER");
      this.run("INSERT OR IGNORE INTO schema_version VALUES(2)");
      this.run("INSERT OR IGNORE INTO schema_version VALUES(3)");
      this.run("INSERT OR IGNORE INTO settings VALUES('sync_enabled','true')");
      this.run(
        "INSERT OR IGNORE INTO settings VALUES('booking_enabled','true')",
      );
    });
    this.raw.exec(`
      CREATE INDEX IF NOT EXISTS audit_expiry ON audit(at);
      CREATE INDEX IF NOT EXISTS sync_history_expiry ON sync_runs(COALESCE(finished_at,started_at)) WHERE status IN ('success','failed');
      CREATE INDEX IF NOT EXISTS job_history_expiry ON jobs(COALESCE(finished_at,locked_at,run_at)) WHERE state IN ('done','failed');
    `);
  }
  all<T>(sql: string, ...args: SQLInputValue[]): T[] {
    return this.raw.prepare(sql).all(...args) as unknown as T[];
  }
  get<T>(sql: string, ...args: SQLInputValue[]): T | undefined {
    return this.raw.prepare(sql).get(...args) as unknown as T | undefined;
  }
  run(sql: string, ...args: SQLInputValue[]) {
    return this.raw.prepare(sql).run(...args);
  }
  tx<T>(fn: () => T): T {
    this.raw.exec("BEGIN IMMEDIATE");
    try {
      const out = fn();
      this.raw.exec("COMMIT");
      return out;
    } catch (e) {
      this.raw.exec("ROLLBACK");
      throw e;
    }
  }
  setting(key: string, fallback = ""): string {
    return (
      this.get<{ value: string }>("SELECT value FROM settings WHERE key=?", key)
        ?.value ?? fallback
    );
  }
  set(key: string, value: string) {
    this.run(
      "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  }
  audit(
    actor: string,
    action: string,
    entity: string,
    detail: Record<string, unknown> = {},
  ) {
    this.run(
      "INSERT INTO audit(actor,action,entity_id,detail,at) VALUES(?,?,?,?,?)",
      actor,
      action,
      entity,
      JSON.stringify(detail),
      Date.now(),
    );
  }
  alert(code: string, entity = "system") {
    const now = Date.now();
    this.run(
      "INSERT INTO alerts(code,entity_id,first_at,last_at) VALUES(?,?,?,?) ON CONFLICT(code,entity_id) WHERE ack_at IS NULL DO UPDATE SET last_at=excluded.last_at,occurrences=alerts.occurrences+1",
      code,
      entity,
      now,
      now,
    );
    // Structured event for a host log collector. No upstream messages or identifiers.
    console.warn(JSON.stringify({ event: "ops.alert", code }));
  }
  close() {
    this.raw.close();
  }
}
