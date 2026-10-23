import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../../src/server/database/schemas'
import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { createTestDatabase } from '../support/postgres'
import { bookingMigrations } from '../../src/server/open-space/postgres-schema'
import { applyDatabaseMigrations, databaseStatus, runDatabaseOperation, setupAdministrator, COMMUNITY_CLEAR_TABLES, BOOKING_CLEAR_TABLES } from '../../deploy/database.mjs'
import { COMMUNITY_SCHEMA_CHECK_SQL } from '../../src/server/database/community-schema-query.mjs'

const pool = db.$client
const booking = createTestDatabase('managementbooking')
const userId = '11111111-1111-4111-8111-111111111111'
const admin = { email: 'custom-admin@example.test', name: '自定义管理员', passwordHash: '' }
const migrations = ['20261021-community.sql', '20261022-community-interactions.sql', '20261023-achievements-images.sql'].map(name => ({
    name, sql: readFileSync(new URL(`../../deploy/migrations/${name}`, import.meta.url), 'utf8'),
}))

beforeAll(async () => {
    await initializeDatabase()
    await booking.initialize()
    await booking.client.query('CREATE TABLE schema_version(version integer PRIMARY KEY); INSERT INTO schema_version VALUES (4)')
    await booking.client.query(bookingMigrations[0].sql)
    admin.passwordHash = await bcrypt.hash('custom-admin-password', 12)
})
afterAll(async () => { await booking.close(); await client.close() })
beforeEach(async () => {
    await resetDatabase()
    await booking.client.query(`TRUNCATE ${BOOKING_CLEAR_TABLES.map(name => `"${name}"`).join(', ')} RESTART IDENTITY`)
    await pool.query(`INSERT INTO users(id,email,name,password_hash,role) VALUES ($1,'student@example.test','学生','existing-hash','student')`, [userId])
})

it('creates only one administrator from custom input without a backup, business data or leaked hashes', async () => {
    const backup = vi.fn(() => { throw new Error('must not back up') })
    const result = await runDatabaseOperation({ action: 'db-setup', admin }, pool, backup)
    expect(result).toMatchObject({ administrator: { email: admin.email, name: admin.name, role: 'admin' } })
    expect(JSON.stringify(result)).not.toContain(admin.passwordHash)
    const [created] = (await pool.query("SELECT * FROM users WHERE role='admin'")).rows
    expect(await bcrypt.compare('custom-admin-password', created.password_hash)).toBe(true)
    expect(backup).not.toHaveBeenCalled()
    for (const name of COMMUNITY_CLEAR_TABLES.filter(name => name !== 'users')) {
        expect((await pool.query(`SELECT count(*)::int AS n FROM "${name}"`)).rows[0].n).toBe(0)
    }
    expect((await booking.client.query('SELECT * FROM users')).rows).toEqual([])
    await expect(setupAdministrator(pool, admin)).rejects.toThrow('已有管理员')
    expect((await pool.query("SELECT * FROM users WHERE role='admin'")).rowCount).toBe(1)
})

it('serializes concurrent setup attempts and never promotes existing users or replaces inactive admins', async () => {
    await expect(setupAdministrator(pool, { ...admin, email: 'student@example.test' })).rejects.toThrow('不会提升')
    const result = await Promise.allSettled([setupAdministrator(pool, admin), setupAdministrator(pool, { ...admin, email: 'second@example.test' })])
    expect(result.filter(value => value.status === 'fulfilled')).toHaveLength(1)
    await pool.query("UPDATE users SET is_active=false WHERE role='admin'")
    await expect(setupAdministrator(pool, admin)).rejects.toThrow('已有管理员')
    expect((await pool.query('SELECT role FROM users WHERE id=$1', [userId])).rows[0].role).toBe('student')
})

it('rejects plaintext passwords and invalid setup input without any writes', async () => {
    for (const input of [null, { ...admin, passwordHash: 'plaintext' }, { ...admin, email: 'invalid' }, { ...admin, name: ' ' }, { ...admin, passwordHash: admin.passwordHash.replace('$12$', '$04$') }]) {
        await expect(setupAdministrator(pool, input)).rejects.toThrow('输入无效')
    }
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(1)
})

async function populate() {
    await setupAdministrator(pool, admin)
    await pool.query("INSERT INTO feedbacks(author_id,title,content,target_type) VALUES ($1,'旧反馈','内容','general')", [userId])
    await booking.client.query("INSERT INTO users VALUES ('legacy-owner','old@example.test','旧管理员','legacy-hash','admin')")
    await booking.client.query("INSERT INTO sessions VALUES ('old-session','legacy-owner','csrf',9999999999999)")
    await booking.client.query("INSERT INTO settings VALUES ('booking_enabled','true')")
    await booking.client.query("INSERT INTO booking_allowlist VALUES ('0000000001','旧白名单',1)")
}

it('previews read-only, then clears all accounts and application records without a backup while preserving schema versions', async () => {
    expect(COMMUNITY_CLEAR_TABLES.slice().sort()).toEqual(Object.values(schema).flatMap(value => is(value, PgTable) ? [getTableName(value)] : []).sort())
    await populate()
    const backup = vi.fn(() => { throw new Error('must not back up') })
    const request = { action: 'db-clear', bookingSchema: booking.name }
    const preview = await runDatabaseOperation(request, pool, backup)
    expect(preview).toMatchObject({ preview: true, backup: false, bookingInitialized: true })
    expect(preview.cleared.find((value: { table: string; rows: number }) => value.table.endsWith('."users"'))?.rows).toBe(2)
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(2)
    const result = await runDatabaseOperation({ ...request, execute: true }, pool, backup)
    expect(result).toMatchObject({ preview: false, backup: false })
    for (const name of COMMUNITY_CLEAR_TABLES) expect((await pool.query(`SELECT count(*)::int AS n FROM "${name}"`)).rows[0].n).toBe(0)
    for (const name of BOOKING_CLEAR_TABLES) expect((await booking.client.query(`SELECT count(*)::int AS n FROM "${name}"`)).rows[0].n).toBe(0)
    expect((await booking.client.query('SELECT * FROM schema_version')).rows).toEqual([{ version: 4 }])
    expect(backup).not.toHaveBeenCalled()
    await setupAdministrator(pool, admin)
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(1)
})

it('rolls back both schemas if truncation fails and refuses references outside the clear scope', async () => {
    await populate()
    await pool.query("CREATE TABLE external_ref(user_id uuid REFERENCES users(id)); INSERT INTO external_ref VALUES ('11111111-1111-4111-8111-111111111111')")
    try {
        await expect(runDatabaseOperation({ action: 'db-clear', execute: true, bookingSchema: booking.name }, pool)).rejects.toThrow('拒绝级联')
    } finally { await pool.query('DROP TABLE external_ref') }
    await pool.query(`CREATE FUNCTION reject_clear() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'clear rejected'; END $$`)
    await pool.query('CREATE TRIGGER reject_clear BEFORE TRUNCATE ON users EXECUTE FUNCTION reject_clear()')
    try {
        await expect(runDatabaseOperation({ action: 'db-clear', execute: true, bookingSchema: booking.name }, pool)).rejects.toThrow('clear rejected')
        expect((await pool.query('SELECT * FROM users')).rowCount).toBe(2)
        expect((await pool.query('SELECT * FROM feedbacks')).rowCount).toBe(1)
        expect((await booking.client.query('SELECT * FROM sessions')).rowCount).toBe(1)
        expect((await booking.client.query('SELECT * FROM booking_allowlist')).rowCount).toBe(1)
    } finally { await pool.query('DROP TRIGGER reject_clear ON users; DROP FUNCTION reject_clear()') }
})

it('rejects invalid namespaces, missing tables and invalid execute flags, and supports an uninitialized booking schema', async () => {
    const current = (await pool.query('SELECT current_schema() AS name')).rows[0].name
    for (const bookingSchema of [current, 'pg_catalog', 'information_schema', 'invalid;schema']) {
        await expect(runDatabaseOperation({ action: 'db-clear', execute: true, bookingSchema }, pool)).rejects.toThrow()
    }
    await expect(runDatabaseOperation({ action: 'db-clear', execute: 'true', bookingSchema: booking.name }, pool)).rejects.toThrow('布尔值')
    await pool.query('ALTER TABLE feedbacks RENAME TO missing_feedbacks')
    try {
        await expect(runDatabaseOperation({ action: 'db-clear', execute: true, bookingSchema: booking.name }, pool)).rejects.toThrow('表结构不完整')
    } finally { await pool.query('ALTER TABLE missing_feedbacks RENAME TO feedbacks') }
    const result = await runDatabaseOperation({ action: 'db-clear', execute: true, bookingSchema: 'coeer_absent_booking' }, pool)
    expect(result.bookingInitialized).toBe(false)
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(0)
})

it('upgrades legacy community schemas and blocks migration writes after failed backups', async () => {
    await pool.query('DROP TABLE bookmarks,notifications,password_resets')
    expect((await databaseStatus(pool, COMMUNITY_SCHEMA_CHECK_SQL)).ready).toBe(false)
    await applyDatabaseMigrations(pool, migrations, COMMUNITY_SCHEMA_CHECK_SQL)
    expect((await databaseStatus(pool, COMMUNITY_SCHEMA_CHECK_SQL)).ready).toBe(true)
    await applyDatabaseMigrations(pool, migrations, COMMUNITY_SCHEMA_CHECK_SQL)
    await expect(applyDatabaseMigrations(pool, [{ name: 'broken.sql', sql: 'BEGIN; CREATE TABLE must_rollback(id int); SELECT * FROM missing_migration_table; COMMIT;' }], COMMUNITY_SCHEMA_CHECK_SQL)).rejects.toMatchObject({ code: '42P01' })
    expect((await pool.query("SELECT to_regclass('must_rollback') AS name")).rows[0].name).toBeNull()
    await expect(runDatabaseOperation({ action: 'db-upgrade', migrations, schemaCheck: COMMUNITY_SCHEMA_CHECK_SQL }, pool, () => { throw new Error('backup unavailable') })).rejects.toThrow('backup unavailable')
    await expect(runDatabaseOperation({ action: 'db-seed', user: 'student@example.test' }, pool)).rejects.toThrow('不支持')
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(1)
})
