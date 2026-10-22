// Also sent over SSH stdin: imports resolve against the active release's dependencies.
import { createHash, randomBytes } from 'node:crypto'
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

function demoId(userId, entity) {
    const hex = createHash('sha256').update('coeer:deployment-demo:v1:' + userId + ':' + entity).digest('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export async function findDemoUser(pool, email) {
    const { rows: [user] } = await pool.query('SELECT id, email FROM users WHERE lower(email) = lower($1) AND is_active = true', [email])
    if (!user) throw new Error('指定的已有账号不存在或已停用；导入不会创建账号。')
    return user
}

export async function seedDeploymentDemo(pool, email) {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { rows: [user] } = await client.query('SELECT id, email FROM users WHERE lower(email) = lower($1) AND is_active = true FOR UPDATE', [email])
        if (!user) throw new Error('指定的已有账号不存在或已停用；导入不会创建账号。')
        const id = entity => demoId(user.id, entity)
        const slug = 'coeer-demo-' + user.id
        await client.query(`INSERT INTO groups (id, name, slug, description, category, creator_id, status, is_public)
            VALUES ($1, '部署测试空间', $2, '仅用于指定账号的功能验收。', 'project', $3, 'approved', false) ON CONFLICT DO NOTHING`, [id('group'), slug, user.id])
        const { rows: [group] } = await client.query('SELECT id, creator_id, is_public FROM groups WHERE id=$1 AND slug=$2', [id('group'), slug])
        if (!group || group.creator_id !== user.id || group.is_public) throw new Error('演示空间标识被占用或已公开，未修改任何数据。')
        await client.query(`INSERT INTO group_members (group_id,user_id,role,status) VALUES ($1,$2,'admin','approved') ON CONFLICT DO NOTHING`, [group.id, user.id])
        await client.query(`INSERT INTO group_posts (id,group_id,author_id,title,content,type) VALUES ($1,$2,$3,'部署验收示例帖子',$4,'discussion') ON CONFLICT DO NOTHING`,
            [id('post'), group.id, user.id, '这是一条测试数据，可用于验证帖子、收藏与 Markdown。\n\n行内公式：$x^2+y^2=1$。'])
        await client.query('INSERT INTO bookmarks (user_id,post_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, id('post')])
        // Reuse the real catalog. A zero-weight demo card is created only for an empty catalog.
        let { rows: catalog } = await client.query('SELECT id FROM cards ORDER BY created_at,id LIMIT 3')
        if (!catalog.length) {
            await client.query(`INSERT INTO cards (id,name,description,image_url,rarity,series,drop_rate) VALUES ($1,'部署测试纪念卡','演示导入创建的测试卡片。','/demo/card-rare.svg','rare','deployment-demo',0) ON CONFLICT DO NOTHING`, [demoId('catalog', 'card')])
            catalog = [{ id: demoId('catalog', 'card') }]
        }
        for (const card of catalog) await client.query('INSERT INTO user_cards (user_id,card_id,count) VALUES ($1,$2,1) ON CONFLICT DO NOTHING', [user.id, card.id])
        await client.query(`INSERT INTO achievements (id,code,name,description,condition_type,condition_value) VALUES ($1,'DEPLOYMENT_DEMO','部署验收参与者','通过显式测试数据导入解锁的演示成就。','action',1) ON CONFLICT DO NOTHING`, [demoId('catalog', 'achievement')])
        const { rows: [achievement] } = await client.query("SELECT id FROM achievements WHERE code='DEPLOYMENT_DEMO'")
        await client.query('INSERT INTO user_achievements (user_id,achievement_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [user.id, achievement.id])
        const points = await client.query(`INSERT INTO point_transactions (id,user_id,amount,type,source,description) VALUES ($1,$2,200,'earn','adjustment','部署演示：一次性测试积分') ON CONFLICT DO NOTHING RETURNING id`, [id('points'), user.id])
        await client.query(`INSERT INTO notifications (id,user_id,type,title,content,href) VALUES ($1,$2,'deployment_demo','测试数据已就绪','已添加私密演示帖子、收藏、卡片、成就及一次性测试积分。',$3) ON CONFLICT DO NOTHING`, [id('notification'), user.id, '/groups/' + slug + '/posts/' + id('post')])
        await client.query('COMMIT')
        return { user: user.email, group: slug, cards: catalog.length, pointsGranted: points.rowCount ? 200 : 0 }
    } catch (error) {
        await client.query('ROLLBACK')
        throw error
    } finally { client.release() }
}

export async function runDatabaseOperation(request, pool, makeBackup) {
    if (!['db-status', 'db-backup', 'db-upgrade', 'db-seed'].includes(request.action)) throw new Error('不支持的数据库操作。')
    if (request.action === 'db-status') return databaseStatus(pool, request.schemaCheck)
    if (request.action === 'db-seed') {
        await pool.query(request.schemaCheck)
        await findDemoUser(pool, request.user)
    }
    const backup = makeBackup()
    // Once verified, print the backup location before any potentially failing write.
    if (request.action !== 'db-backup') console.log(JSON.stringify({ backup }))
    if (request.action === 'db-backup') return { backup }
    if (request.action === 'db-upgrade') return { backup, ...await applyDatabaseMigrations(pool, request.migrations, request.schemaCheck) }
    if (request.action === 'db-seed') return { backup, ...await seedDeploymentDemo(pool, request.user) }
    throw new Error('不支持的数据库操作。')
}

async function main() {
    const request = JSON.parse(process.env.COEER_DB_REQUEST)
    config({ path: ['.env.production.local', '.env.local', '.env.production', '.env'], quiet: true })
    if (request.action === 'db-backups') {
        console.log(JSON.stringify({ backups: listDatabaseBackups(request.backupDirectory) }, null, 2))
        return
    }
    if (!process.env.DATABASE_URL) throw new Error('服务器未配置 DATABASE_URL。')
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, query_timeout: 30000 })
    try {
        const result = await runDatabaseOperation(request, pool, () => backupDatabase(process.env.DATABASE_URL, request.backupDirectory))
        console.log(JSON.stringify(result, null, 2))
    } finally { await pool.end() }
}

if (process.argv[1] === '-') {
    main().catch(error => {
        // pg errors can contain SQL, credentials or rows. Return only a stable code.
        console.error(error.code ? '数据库操作失败，错误代码：' + error.code : error.message)
        process.exitCode = 1
    })
}
