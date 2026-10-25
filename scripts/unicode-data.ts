import { randomUUID, createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { closeSync, fsyncSync, mkdirSync, mkdtempSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Pool } from 'pg'
import { backupDatabase } from '../deploy/database.mjs'
import { loadEnvironmentFiles } from '../src/server/config/environment-files'
import { digest, lockUnicodeTables, planUnicodeMigration, publicMigrationReport, readUnicodeSnapshot, writeUnicodeChanges,
    UNICODE_TEXT_TABLES, type TextSnapshot } from '../src/server/database/unicode-migration'

loadEnvironmentFiles()
const [action = 'scan', ...args] = process.argv.slice(2)
const options = new Map<string, string>()
for (let i = 0; i < args.length; i += 2) {
    if (!['--out', '--report', '--manifest'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw new Error('参数错误')
    options.set(args[i], args[i + 1])
}
if (!['scan', 'verify', 'apply', 'rollback'].includes(action)) throw new Error('用法：pnpm db:unicode scan|verify|apply --report <scan.json>|rollback --manifest <manifest.json>')
if (!process.env.DATABASE_URL) throw new Error('未配置 DATABASE_URL')
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 })
const root = resolve(process.env.COEER_UNICODE_DIR ?? '.coeer-local/unicode')
const sql = readFileSync(new URL('../deploy/migrations/20261026-unicode-usernames.sql', import.meta.url), 'utf8')
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
function durableJson(path: string, value: unknown) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    const fd = openSync(path, 'wx', 0o600)
    try { writeFileSync(fd, JSON.stringify(value, null, 2)); fsyncSync(fd) } finally { closeSync(fd) }
    if (digest(json(path)) !== digest(value)) throw new Error('备份写入后校验失败')
}

type Manifest = { id: string; reportFingerprint: string; snapshot: TextSnapshot;
    backup: { path: string; sha256: string }; plan: ReturnType<typeof planUnicodeMigration> }

const client = await pool.connect()
try {
    if (action === 'scan' || action === 'verify') {
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        const report = publicMigrationReport(await readUnicodeSnapshot(client))
        await client.query('COMMIT')
        const path = resolve(options.get('--out') ?? join(root, `scan-${Date.now()}.json`))
        durableJson(path, report)
        console.log(JSON.stringify({ report: path, ...report }, null, 2))
        if (action === 'verify' && (report.changedFields || !report.indexExisted)) throw new Error('复扫失败：仍有不合规/未规范化/重名文本，或唯一索引尚未建立')
    } else if (action === 'apply') {
        const reportPath = options.get('--report')
        if (!reportPath) throw new Error('apply 必须指定事先生成的 --report；先检查统计及示例')
        const report = json(resolve(reportPath))
        mkdirSync(root, { recursive: true, mode: 0o700 })
        const directory = mkdtempSync(join(root, 'run-'))
        // Full DB backup + pg_restore catalog verification precede ANY data changes.
        const backup = backupDatabase(process.env.DATABASE_URL, directory)
        const backupPath = join(backup.directory, backup.name)
        // Read/decompress the entire archive, not only its table of contents. SQL goes to /dev/null.
        const archiveCheck = spawnSync('pg_restore', ['--file=-', backupPath], { stdio: 'ignore', timeout: 120000 })
        if (archiveCheck.error || archiveCheck.status !== 0) throw new Error('完整备份解码校验失败；未执行数据库变更')
        await client.query('BEGIN')
        await lockUnicodeTables(client)
        const snapshot = await readUnicodeSnapshot(client)
        if (report.fingerprint !== digest(snapshot)) throw new Error('扫描后数据或目标数据库已变化；请重新 scan，再审核新报告')
        // Unknown write triggers/materialized copies could change nontext fields or leave stale data.
        const { rows: unexpected } = await client.query(`SELECT tgname AS name FROM pg_trigger
            WHERE NOT tgisinternal AND tgrelid IN (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname=current_schema() AND c.relname=ANY($1::text[]))
            UNION ALL SELECT matviewname FROM pg_matviews WHERE schemaname=current_schema()`, [Object.keys(UNICODE_TEXT_TABLES)])
        if (unexpected.length) throw new Error('发现未纳入迁移的触发器/物化视图；请先审查其文本派生逻辑')
        const manifest: Manifest = { id: randomUUID(), reportFingerprint: report.fingerprint, snapshot,
            backup: { path: backupPath, sha256: fileHash(backupPath) }, plan: planUnicodeMigration(snapshot.records) }
        const manifestPath = join(directory, 'manifest.json')
        // Exact before-images are captured under write locks; dump may predate these locks.
        durableJson(manifestPath, manifest)
        await client.query(`CREATE TABLE IF NOT EXISTS unicode_migration_runs (
            id uuid PRIMARY KEY, manifest_sha256 text NOT NULL, manifest_path text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now(), rolled_back_at timestamptz)`)
        await client.query('DROP INDEX IF EXISTS users_name_unicode_key')
        await writeUnicodeChanges(client, manifest.plan.changes)
        await client.query(sql)
        const after = publicMigrationReport(await readUnicodeSnapshot(client))
        if (after.changedFields || !after.indexExisted) throw new Error('清理后的事务内复扫失败')
        await client.query('INSERT INTO unicode_migration_runs(id, manifest_sha256, manifest_path) VALUES ($1,$2,$3)',
            [manifest.id, fileHash(manifestPath), manifestPath])
        await client.query('COMMIT')
        // Independent post-commit scan checks the actual committed database.
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
        const verification = publicMigrationReport(await readUnicodeSnapshot(client))
        await client.query('COMMIT')
        durableJson(join(directory, 'result.json'), { id: manifest.id, manifest: manifestPath, verification })
        console.log(JSON.stringify({ id: manifest.id, manifest: manifestPath, backup: backupPath,
            before: manifest.plan.counts, characterCounts: manifest.plan.characterCounts, verification }, null, 2))
        if (verification.changedFields) throw new Error('提交后有新的不合规写入；清理已提交，请停止旧版本写入并检查 result.json')
    } else {
        const manifestPath = options.get('--manifest')
        if (!manifestPath) throw new Error('rollback 必须指定 --manifest')
        const path = resolve(manifestPath)
        const manifest: Manifest = json(path)
        if (manifest.snapshot.version !== 1 || digest(manifest.plan) !== digest(planUnicodeMigration(manifest.snapshot.records))) throw new Error('备份策略版本或内容不匹配')
        if (fileHash(manifest.backup.path) !== manifest.backup.sha256) throw new Error('数据库备份校验失败')
        await client.query('BEGIN')
        await lockUnicodeTables(client)
        const snapshot = await readUnicodeSnapshot(client)
        if (snapshot.identity !== manifest.snapshot.identity) throw new Error('备份不属于当前数据库/schema')
        const { rows: [run] } = await client.query('SELECT * FROM unicode_migration_runs WHERE id=$1 FOR UPDATE', [manifest.id])
        if (!run || run.manifest_sha256 !== fileHash(path)) throw new Error('迁移审计记录不存在或备份文件已被更改')
        if (run.rolled_back_at) {
            await client.query('ROLLBACK')
            console.log('此迁移已回滚；未重复修改')
        } else {
            durableJson(join(root, `before-rollback-${manifest.id}-${Date.now()}.json`), snapshot)
            await client.query('DROP INDEX IF EXISTS users_name_unicode_key')
            await writeUnicodeChanges(client, manifest.plan.changes, true)
            if (manifest.snapshot.indexExisted) await client.query(sql)
            const restored = await readUnicodeSnapshot(client)
            for (const change of manifest.plan.changes) {
                if (restored.records.find(r => r.table === change.table && r.id === change.id)?.fields[change.field] !== change.before) throw new Error('回滚后逐字段验证失败')
            }
            await client.query('UPDATE unicode_migration_runs SET rolled_back_at=now() WHERE id=$1', [manifest.id])
            await client.query('COMMIT')
            console.log(JSON.stringify({ rolledBack: manifest.id, restoredFields: manifest.plan.changes.length }))
        }
    }
} catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    // PG errors may include user text or credentials; print a code instead of raw details.
    console.error(error && typeof error === 'object' && 'code' in error ? `数据库操作失败：${error.code}` : (error as Error).message)
    process.exitCode = 1
} finally { client.release(); await pool.end() }
