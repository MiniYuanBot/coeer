import { spawn } from 'node:child_process';
import { existsSync, chmodSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { privateTarget } from './adapters/official/session.js';
import { DB } from './db.js';
import { BOOKING_SCHEMA_VERSION } from './postgres-schema.js';

function postgresTool(name: 'pg_dump' | 'pg_restore', args: string[], connectionString?: string) {
  const executable = process.env.PG_BIN_DIR ? join(process.env.PG_BIN_DIR, name + (process.platform === 'win32' ? '.exe' : '')) : name;
  const env = { ...process.env };
  if (connectionString) {
    const url = new URL(connectionString);
    env.PGHOST = url.hostname;
    env.PGPORT = url.port || '5432';
    env.PGUSER = decodeURIComponent(url.username);
    env.PGPASSWORD = decodeURIComponent(url.password);
    env.PGDATABASE = decodeURIComponent(url.pathname.slice(1));
    if (url.searchParams.has('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode')!;
  }
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, args, { env, windowsHide: true, stdio: 'ignore' });
    child.once('error', () => reject(new Error('POSTGRES_BACKUP_TOOL_FAILED: install PostgreSQL client tools or configure PG_BIN_DIR')));
    child.once('close', code => code === 0 ? resolve() : reject(new Error('POSTGRES_BACKUP_TOOL_FAILED')));
  });
}

export async function verifyDatabase(connectionString: string, schema = 'coeer_spaces') {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) throw new Error('INVALID_DATABASE_SCHEMA');
  const pool = new Pool({ connectionString, options: `-c search_path=${schema}`, connectionTimeoutMillis: 10000 });
  try {
    const { rows } = await pool.query('SELECT MAX(version) AS version FROM schema_version');
    const version = rows[0]?.version;
    if (typeof version !== 'number' || version > BOOKING_SCHEMA_VERSION) throw new Error('DATABASE_VERSION_UNSUPPORTED');
    const invalid = await pool.query('SELECT 1 FROM pg_constraint WHERE connamespace=$1::regnamespace AND NOT convalidated LIMIT 1', [schema]);
    if (invalid.rowCount) throw new Error('DATABASE_CONSTRAINTS_NOT_VALIDATED');
    return { integrity: 'ok', version, database: 'postgresql' };
  } finally { await pool.end(); }
}

export async function backupDatabase(source: string, destination: string, schema = 'coeer_spaces') {
  if (existsSync(destination)) throw new Error('BACKUP_PATH_EXISTS');
  privateTarget(destination);
  await verifyDatabase(source, schema);
  const temp = `${destination}.${randomUUID()}.tmp`;
  try {
    await postgresTool('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', `--schema=${schema}`, `--file=${temp}`], source);
    if (process.platform !== 'win32') chmodSync(temp, 0o600);
    await postgresTool('pg_restore', ['--list', temp]);
    renameSync(temp, destination);
  } finally { rmSync(temp, { force: true }); }
}

/** Restore into an empty target namespace; existing data is never overwritten. */
export async function restoreDatabase(source: string, destination: string, schema = 'coeer_spaces') {
  if (!existsSync(source)) throw new Error('BACKUP_NOT_FOUND');
  await postgresTool('pg_restore', ['--list', source]);
  await postgresTool('pg_restore', ['--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error', `--schema=${schema}`, '--dbname=' + decodeURIComponent(new URL(destination).pathname.slice(1)), source], destination);
  const db = await DB.open(destination, schema);
  try {
    await db.tx(async () => {
      // A backup can predate official writes. Never replay queued mutations.
      await db.set('paused', 'true');
      await db.set('booking_enabled', 'false');
      await db.set('sync_enabled', 'false');
      await db.run('DELETE FROM booking_access');
      await db.run("UPDATE jobs SET state='failed',error_code='RESTORED_BACKUP',finished_at=? WHERE state IN ('running','pending')", Date.now());
      await db.run("INSERT INTO booking_events(booking_id,status,message,at) SELECT id,'manual_review','备份已恢复，须按官方记录人工核对；不会重放写入',? FROM bookings WHERE status NOT IN ('cancelled','failed')", Date.now());
      await db.run("UPDATE bookings SET status='manual_review',message='备份已恢复，须按官方记录人工核对；不会重放写入',updated_at=? WHERE status NOT IN ('cancelled','failed')", Date.now());
      await db.audit('operator', 'database.restored', 'system');
    });
  } finally { await db.close(); }
}
