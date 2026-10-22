import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types, type PoolClient } from 'pg';
import { BOOKING_SCHEMA_VERSION, bookingMigrations } from './postgres-schema.js';

type SQLValue = string | number | bigint | boolean | null | Uint8Array;

/** Compile internal parameterized statements into PostgreSQL syntax. */
function statement(source: string) {
  const ignore = /^INSERT OR IGNORE\b/i.test(source);
  source = source.replace(/^INSERT OR IGNORE\b/i, 'INSERT');
  let parameter = 0;
  // String literals are copied intact; parameters and identifiers are SQL, never values.
  source = source.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?|\b[a-zA-Z_][a-zA-Z_0-9]*\b/g, token => {
    if (token === '?') return `$${++parameter}`;
    if (token === 'end') return '"end"';
    if (/^[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*$/.test(token)) return `"${token}"`;
    return token;
  });
  return ignore ? source + ' ON CONFLICT DO NOTHING' : source;
}

export class DB {
  private readonly transaction = new AsyncLocalStorage<PoolClient>();
  private constructor(readonly pool: Pool, readonly schema: string) {}

  static async open(connectionString = process.env.DATABASE_URL, schema = process.env.BOOKING_DB_SCHEMA ?? 'coeer_spaces') {
    if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString)) {
      throw new Error('Reservations require the PostgreSQL DATABASE_URL configured in .env');
    }
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema) || ['public', 'information_schema'].includes(schema) || schema.startsWith('pg_')) {
      throw new Error('Invalid reservation PostgreSQL schema');
    }
    const pool = new Pool({
      connectionString, max: 5, connectionTimeoutMillis: 10000,
      options: `-c search_path=${schema}`,
      types: { getTypeParser: (oid: number, format?: 'text' | 'binary') => oid === 20 ? Number : types.getTypeParser(oid, format) },
    });
    const db = new DB(pool, schema);
    try {
      await db.tx(async () => {
        await db.executor().query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
        await db.executor().query('CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY)');
        const current = (await db.get<{ version: number }>('SELECT COALESCE(MAX(version),0) AS version FROM schema_version'))!.version;
        if (current > BOOKING_SCHEMA_VERSION) throw new Error('Reservation schema requires a newer application');
        for (const migration of bookingMigrations) {
          if (migration.version <= current) continue;
          await db.executor().query(migration.sql);
          await db.run('INSERT INTO schema_version VALUES(?)', migration.version);
        }
      });
      return db;
    } catch (error) {
      await pool.end();
      throw error;
    }
  }
  private executor() { return this.transaction.getStore() ?? this.pool; }
  async all<T>(sql: string, ...args: SQLValue[]): Promise<T[]> {
    return (await this.executor().query(statement(sql), args)).rows as T[];
  }
  async get<T>(sql: string, ...args: SQLValue[]): Promise<T | undefined> {
    return (await this.all<T>(sql, ...args))[0];
  }
  async run(sql: string, ...args: SQLValue[]) {
    const result = await this.executor().query(statement(sql), args);
    return { changes: result.rowCount ?? 0 };
  }
  async tx<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.transaction.getStore()) return await fn();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // The original engine serialized booking writes. Keep that guarantee across processes,
      // including quota/capacity checks and atomic worker claims, without blocking Node.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`coeer.spaces.${this.schema}`]);
      const result = await this.transaction.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  async setting(key: string, fallback = '') {
    return (await this.get<{ value: string }>('SELECT value FROM settings WHERE key=?', key))?.value ?? fallback;
  }
  async set(key: string, value: string) {
    await this.run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
  }
  async audit(actor: string, action: string, entity: string, detail: Record<string, unknown> = {}) {
    await this.run('INSERT INTO audit(actor,action,entity_id,detail,at) VALUES(?,?,?,?,?)', actor, action, entity, JSON.stringify(detail), Date.now());
  }
  async alert(code: string, entity = 'system') {
    const now = Date.now();
    await this.run('INSERT INTO alerts(code,entity_id,first_at,last_at) VALUES(?,?,?,?) ON CONFLICT(code,entity_id) WHERE ack_at IS NULL DO UPDATE SET last_at=excluded.last_at,occurrences=alerts.occurrences+1', code, entity, now, now);
    console.warn(JSON.stringify({ event: 'ops.alert', code }));
  }
  async close() { await this.pool.end(); }
}
