/** Reservation tables share COEER's PostgreSQL server in a separate namespace. */
export const BOOKING_SCHEMA_VERSION = 4;
const baseline = `
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','admin')));
CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY,module TEXT NOT NULL,official_id TEXT NOT NULL,name TEXT NOT NULL,location TEXT NOT NULL,description TEXT NOT NULL,capacity INTEGER NOT NULL,amenities TEXT NOT NULL,policy TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,bookable INTEGER NOT NULL DEFAULT 0,upstream_enabled INTEGER NOT NULL DEFAULT 1,provider TEXT NOT NULL DEFAULT 'mock',permission TEXT NOT NULL DEFAULT 'allowed',source_metadata TEXT NOT NULL DEFAULT '{}',UNIQUE(module,official_id));
CREATE TABLE IF NOT EXISTS snapshots(space_id TEXT NOT NULL REFERENCES spaces(id),date TEXT NOT NULL,slots TEXT NOT NULL,included_refs TEXT NOT NULL,observed_at BIGINT NOT NULL,PRIMARY KEY(space_id,date));
CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),space_id TEXT NOT NULL REFERENCES spaces(id),date TEXT NOT NULL,start INTEGER NOT NULL,"end" INTEGER NOT NULL,quantity INTEGER NOT NULL,purpose TEXT NOT NULL,status TEXT NOT NULL,message TEXT NOT NULL,official_ref TEXT,cancel_requested INTEGER NOT NULL DEFAULT 0,idempotency_key TEXT NOT NULL,fingerprint TEXT NOT NULL,created_at BIGINT NOT NULL,updated_at BIGINT NOT NULL,provider TEXT NOT NULL DEFAULT 'mock',applicant_name TEXT,student_id TEXT,submission_user_id TEXT,UNIQUE(user_id,idempotency_key),CHECK(start<"end"),CHECK(quantity>0));
CREATE INDEX IF NOT EXISTS booking_range ON bookings(space_id,date,start,"end");
CREATE TABLE IF NOT EXISTS booking_access(booking_id TEXT PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,door_code TEXT NOT NULL,verified_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS booking_allowlist(student_id TEXT PRIMARY KEY CHECK(student_id ~ '^[0-9]{10}$'),name TEXT NOT NULL DEFAULT '',updated_at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS user_accounts(user_id TEXT PRIMARY KEY REFERENCES users(id),student_id TEXT UNIQUE NOT NULL CHECK(student_id ~ '^[0-9]{10}$'),booking_permission TEXT NOT NULL CHECK(booking_permission IN ('allowed','review','blocked')),enabled INTEGER NOT NULL DEFAULT 1,password_changed_at BIGINT);
CREATE TABLE IF NOT EXISTS booking_events(id BIGSERIAL PRIMARY KEY,booking_id TEXT NOT NULL REFERENCES bookings(id),status TEXT NOT NULL,message TEXT NOT NULL,at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id BIGSERIAL PRIMARY KEY,type TEXT NOT NULL,booking_id TEXT REFERENCES bookings(id),state TEXT NOT NULL DEFAULT 'pending',run_at BIGINT NOT NULL,locked_at BIGINT,attempts INTEGER NOT NULL DEFAULT 0,error_code TEXT,finished_at BIGINT);
CREATE UNIQUE INDEX IF NOT EXISTS active_job ON jobs(type,COALESCE(booking_id,'')) WHERE state IN ('pending','running');
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
INSERT INTO settings VALUES('paused','false'),('sync_enabled','true'),('booking_enabled','true') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS audit(id BIGSERIAL PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS sync_runs(id TEXT PRIMARY KEY,status TEXT NOT NULL,started_at BIGINT NOT NULL,finished_at BIGINT,error_code TEXT,snapshot_count INTEGER NOT NULL DEFAULT 0,provider TEXT NOT NULL DEFAULT 'mock');
CREATE TABLE IF NOT EXISTS mock_reservations(ref TEXT PRIMARY KEY,request_id TEXT UNIQUE NOT NULL,space_id TEXT NOT NULL,date TEXT NOT NULL,start INTEGER NOT NULL,"end" INTEGER NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS mock_scenarios(space_id TEXT PRIMARY KEY,scenario TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS adapter_calls(id BIGSERIAL PRIMARY KEY,operation TEXT NOT NULL,request_id TEXT NOT NULL,at BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS official_bindings(request_id TEXT PRIMARY KEY,official_ref TEXT UNIQUE NOT NULL,account_alias TEXT NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS alerts(id BIGSERIAL PRIMARY KEY,code TEXT NOT NULL,entity_id TEXT NOT NULL,first_at BIGINT NOT NULL,last_at BIGINT NOT NULL,occurrences INTEGER NOT NULL DEFAULT 1,ack_at BIGINT,ack_by TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS open_alert ON alerts(code,entity_id) WHERE ack_at IS NULL;
CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,until BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_expiry ON audit(at);
CREATE INDEX IF NOT EXISTS sync_history_expiry ON sync_runs(COALESCE(finished_at,started_at)) WHERE status IN ('success','failed');
CREATE INDEX IF NOT EXISTS job_history_expiry ON jobs(COALESCE(finished_at,locked_at,run_at)) WHERE state IN ('done','failed');
`;

/** Append ordered, additive migrations here; never rewrite a previously released entry. */
export const bookingMigrations = [{ version: 4, sql: baseline }];
