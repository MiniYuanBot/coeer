// Also sent over SSH stdin: imports resolve against the active release's dependencies.
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { Pool } from 'pg'

const backupPattern = /^coeer-db-\d{17}-[a-f0-9]{8}\.dump$/

export function postgresEnvironment(connectionString, inherited = process.env) {
    const url = new URL(connectionString)
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL 必须为 PostgreSQL URL。')
    // Separate libpq variables keep passwords out of process arguments. PGDATABASE
    // alone is not reliably expanded as a URI by pg_dump.
    const environment = { ...Object.fromEntries(Object.entries(inherited).filter(([key]) => !key.startsWith('PG'))), PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: '10' }
    for (const [parameter, variable] of Object.entries({ sslmode: 'PGSSLMODE', sslrootcert: 'PGSSLROOTCERT',
        sslcert: 'PGSSLCERT', sslkey: 'PGSSLKEY', options: 'PGOPTIONS', channel_binding: 'PGCHANNELBINDING' })) {
        if (url.searchParams.has(parameter)) environment[variable] = url.searchParams.get(parameter)
    }
    return environment
}

function validateBackupDirectory(directory) {
    const info = lstatSync(directory, { throwIfNoEntry: false })
    if (info && (!info.isDirectory() || info.isSymbolicLink())) {
        throw new Error('备份目录必须是普通目录，不能是符号链接。')
    }
}

export function listDatabaseBackups(directory) {
    validateBackupDirectory(directory)
    if (!existsSync(directory)) return []
    return readdirSync(directory).filter(name => backupPattern.test(name)).sort().reverse().flatMap(name => {
        const info = lstatSync(join(directory, name))
        return info.isFile() ? [{ name, bytes: info.size, createdAt: info.mtime.toISOString() }] : []
    })
}

export function deleteDatabaseBackup(directory, name) {
    if (typeof name !== 'string' || name.trim() !== name || !backupPattern.test(name)) {
        throw new Error('必须指定备份列表中的完整 .dump 文件名，不能使用路径或通配符。')
    }
    validateBackupDirectory(directory)
    const destination = join(directory, name)
    const info = lstatSync(destination, { throwIfNoEntry: false })
    if (!info?.isFile() || info.isSymbolicLink()) throw new Error('备份不存在或不是普通文件，未执行删除。')
    unlinkSync(destination)
    return { deleted: name, bytes: info.size, directory }
}

export function backupDatabase(connectionString, directory, run = spawnSync) {
    validateBackupDirectory(directory)
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    chmodSync(directory, 0o700)
    const name = 'coeer-db-' + new Date().toISOString().replace(/\D/g, '') + '-' + randomBytes(4).toString('hex') + '.dump'
    const destination = join(directory, name)
    const temporary = destination + '.partial'
    closeSync(openSync(temporary, 'wx', 0o600))
    try {
        const options = { env: postgresEnvironment(connectionString), stdio: 'pipe', timeout: 120000 }
        const dump = run('pg_dump', ['--no-password', '--format=custom', '--file', temporary], options)
        if (dump.error || dump.status !== 0) throw new Error('pg_dump 备份失败，请检查 PostgreSQL 客户端版本、连接和权限。')
        const verify = run('pg_restore', ['--list', temporary], { stdio: 'pipe', timeout: 30000 })
        if (verify.error || verify.status !== 0 || statSync(temporary).size === 0) throw new Error('备份验证失败，未执行数据库变更。')
        renameSync(temporary, destination)
        return { name, bytes: statSync(destination).size, directory }
    } finally {
        if (existsSync(temporary)) unlinkSync(temporary)
    }
}

export async function databaseStatus(pool, schemaCheck) {
    const { rows: [database] } = await pool.query('SELECT current_database() AS database, current_user AS role, current_schema() AS schema, current_setting(\'server_version\') AS version')
    const { rows: [tables] } = await pool.query("SELECT to_regclass('notifications')::text AS notifications, to_regclass('bookmarks')::text AS bookmarks, to_regclass('password_resets')::text AS password_resets")
    let ready = true
    try { await pool.query(schemaCheck) } catch (error) {
        if (error.code === '42P01' || error.code === '42703') ready = false
        else throw error
    }
    return { ...database, tables, ready }
}

export async function applyDatabaseMigrations(pool, migrations, schemaCheck) {
    const applied = []
    const client = await pool.connect()
    try {
        for (const migration of migrations) {
            try { await client.query(migration.sql) } catch (error) {
                await client.query('ROLLBACK')
                throw error
            }
            applied.push(migration.name)
        }
        await client.query(schemaCheck)
        return { migrations: applied, ready: true }
    } finally { client.release() }
}

// Clear only application tables; never cascade into unrelated schemas.
export const COMMUNITY_CLEAR_TABLES = [
    'users', 'uploaded_images', 'bookmarks', 'notifications', 'password_resets', 'dorm_rooms', 'dorm_questionnaires',
    'dorm_student_profiles', 'dorm_cycles', 'redeem_orders', 'redeem_items', 'user_achievements',
    'achievements', 'user_cards', 'cards', 'point_transactions', 'activity_participants', 'activities',
    'user_subscriptions', 'bulletins', 'reactions', 'replies', 'feedback_status_logs', 'feedbacks',
    'group_posts', 'group_members', 'groups', 'user_profiles',
]
export const BOOKING_CLEAR_TABLES = [
    'sessions', 'booking_access', 'booking_events', 'jobs', 'bookings', 'snapshots', 'user_accounts',
    'users', 'audit', 'sync_runs', 'mock_reservations', 'adapter_calls', 'official_bindings', 'alerts', 'rate_limits',
    'spaces', 'settings', 'booking_allowlist', 'mock_scenarios',
]

function quotedSchema(name) {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name ?? '') || name.startsWith('pg_') || name === 'information_schema') {
        throw new Error('数据库命名空间无效，未执行清理。')
    }
    return '"' + name + '"'
}

async function clearContext(client, bookingSchema) {
    quotedSchema(bookingSchema)
    const { rows: [location] } = await client.query(`SELECT n.nspname AS schema FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=to_regclass('users') AND c.relkind IN ('r','p')`)
    if (!location) throw new Error('找不到社区账号表，请先初始化表结构。')
    const communitySchema = location.schema
    quotedSchema(communitySchema)
    if (communitySchema === bookingSchema) throw new Error('社区与预约命名空间必须不同，未执行清理。')
    const { rows: namespaces } = await client.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [bookingSchema])
    const hasBooking = namespaces.length > 0
    const table = (schema, name) => `${quotedSchema(schema)}."${name}"`
    const targets = [...COMMUNITY_CLEAR_TABLES.map(name => table(communitySchema, name)),
        ...(hasBooking ? BOOKING_CLEAR_TABLES.map(name => table(bookingSchema, name)) : [])]
    const { rows: tables } = await client.query(`SELECT n.nspname AS schema,c.relname AS name FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p')`, [[communitySchema, bookingSchema]])
    const available = new Set(tables.map(value => table(value.schema, value.name)))
    const missing = targets.filter(name => !available.has(name))
    if (missing.length) throw new Error('数据库表结构不完整，请先检查/升级：' + missing.join(', '))
    return { communitySchema, bookingSchema, bookingInitialized: hasBooking, targets }
}

async function clearPlan(client, context) {
    const cleared = []
    for (const table of context.targets) {
        const { rows: [row] } = await client.query(`SELECT count(*)::int AS total FROM ${table}`)
        cleared.push({ table, rows: row.total })
    }
    const { rows: [database] } = await client.query('SELECT current_database() AS database, current_user AS role')
    const { targets, ...location } = context
    return { ...database, ...location, cleared, backup: false,
        notice: '删除全部社区账号及社区、预约数据，包括白名单和预约设置；保留表结构与迁移版本。不创建备份，不取消官网预约。' }
}

export async function clearDatabase(pool, bookingSchema = 'coeer_spaces', execute = false) {
    if (typeof execute !== 'boolean') throw new Error('清空执行标志必须为布尔值。')
    const client = await pool.connect()
    try {
        await client.query(execute ? 'BEGIN' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        if (execute) await client.query("SET LOCAL lock_timeout = '10s'")
        const context = await clearContext(client, bookingSchema)
        if (execute) {
            await client.query(`LOCK TABLE ${context.targets.join(', ')} IN ACCESS EXCLUSIVE MODE`)
            const { rows: externalReferences } = await client.query(`SELECT conname FROM pg_constraint
                WHERE contype='f' AND confrelid=ANY($1::regclass[]) AND NOT (conrelid=ANY($1::regclass[]))`, [context.targets])
            if (externalReferences.length) throw new Error('清理范围之外的表引用了待清理数据，拒绝级联删除。')
        }
        const plan = await clearPlan(client, context)
        if (execute) await client.query(`TRUNCATE TABLE ${context.targets.join(', ')} RESTART IDENTITY`)
        await client.query('COMMIT')
        return { preview: !execute, ...plan }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally { client.release() }
}

export async function setupAdministrator(pool, admin) {
    if (!admin || typeof admin.email !== 'string' || admin.email.length > 254 || admin.email !== admin.email.trim().toLowerCase()
        || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(admin.email)
        || typeof admin.name !== 'string' || !admin.name.trim() || admin.name.length > 63
        || typeof admin.passwordHash !== 'string' || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(admin.passwordHash)) {
        throw new Error('管理员输入无效，请通过交互终端运行 setup。')
    }
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        // Serialize setup with other setup calls and account registration.
        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE')
        const { rows: admins } = await client.query("SELECT id FROM users WHERE role='admin' LIMIT 1")
        if (admins.length) throw new Error('已有管理员，setup 不会重复创建或覆盖密码。')
        const { rows: conflicts } = await client.query('SELECT id FROM users WHERE lower(email)=lower($1)', [admin.email])
        if (conflicts.length) throw new Error('该邮箱已有账号，setup 不会提升已有账号权限。')
        const { rows: [created] } = await client.query(`INSERT INTO users(email,name,password_hash,role,is_active)
            VALUES ($1,$2,$3,'admin',true) RETURNING id,email,name,role`, [admin.email, admin.name.trim(), admin.passwordHash])
        await client.query('COMMIT')
        return { administrator: created }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally { client.release() }
}

export async function runDatabaseOperation(request, pool, makeBackup) {
    if (request.action === 'db-status') return databaseStatus(pool, request.schemaCheck)
    if (request.action === 'db-clear') return clearDatabase(pool, request.bookingSchema ?? 'coeer_spaces', request.execute ?? false)
    if (request.action === 'db-setup') return setupAdministrator(pool, request.admin)
    if (!['db-backup', 'db-upgrade'].includes(request.action)) throw new Error('不支持的数据库操作。')
    const backup = makeBackup()
    if (request.action === 'db-backup') return { backup }
    console.log(JSON.stringify({ backup }))
    return { backup, ...await applyDatabaseMigrations(pool, request.migrations, request.schemaCheck) }
}

export async function runConfiguredOperation(request) {
    const mode = process.env.NODE_ENV || 'development'
    config({ path: [`.env.${mode}.local`, '.env.local', `.env.${mode}`, '.env'], quiet: true })
    if (request.action === 'db-clear') request.bookingSchema = process.env.BOOKING_DB_SCHEMA || 'coeer_spaces'
    if (request.action === 'db-backups') return { directory: request.backupDirectory, backups: listDatabaseBackups(request.backupDirectory) }
    if (request.action === 'db-delete') return deleteDatabaseBackup(request.backupDirectory, request.backup)
    if (!process.env.DATABASE_URL) throw new Error('未配置 DATABASE_URL。')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, query_timeout: 30000 })
    try {
        return await runDatabaseOperation(request, pool, () => backupDatabase(process.env.DATABASE_URL, request.backupDirectory))
    } finally { await pool.end() }
}

if (process.argv[1] === '-') {
    runConfiguredOperation(JSON.parse(process.env.COEER_DB_REQUEST)).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => {
        // pg errors can contain SQL, credentials or rows. Return only a stable code.
        console.error(error.code ? '数据库操作失败，错误代码：' + error.code : error.message)
        process.exitCode = 1
    })
}
