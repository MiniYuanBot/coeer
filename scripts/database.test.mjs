import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { PassThrough, Writable } from 'node:stream'
import { compare } from 'bcryptjs'
import { promptAdministrator, validateAdministratorInput } from './admin-input.mjs'
import { backupDatabase, deleteDatabaseBackup, listDatabaseBackups, postgresEnvironment, runDatabaseOperation } from '../deploy/database.mjs'

const backupName = 'coeer-db-20261022120000000-a1b2c3d4.dump'

test('administrator prompts hide both password entries and return only a bcrypt hash', async () => {
    const input = new PassThrough()
    input.isTTY = true
    input.setRawMode = () => input
    let transcript = ''
    const labels = ['管理员邮箱：', '管理员昵称：', '管理员密码（不回显）：', '再次输入密码（不回显）：']
    const answers = [' Custom@Example.Test ', '自定义管理员', 'private-terminal-password', 'private-terminal-password']
    const output = new Writable({ write(chunk, encoding, callback) {
        const value = chunk.toString()
        transcript += value
        const index = labels.indexOf(value)
        if (index >= 0) setImmediate(() => input.write(answers[index] + '\r'))
        callback()
    } })
    output.isTTY = true
    try {
        const result = await promptAdministrator({ input, output })
        assert.equal(result.email, 'custom@example.test')
        assert.equal(result.name, '自定义管理员')
        assert.equal(await compare(answers[2], result.passwordHash), true)
        assert.equal(result.password, undefined)
        assert.ok(!transcript.includes(answers[2]))
        assert.ok(!transcript.includes(result.passwordHash))
    } finally { input.destroy(); output.destroy() }
})

test('administrator input enforces confirmation and bcrypt byte limits without disclosing passwords', () => {
    for (const values of [ ['invalid', 'Admin', 'long-password', 'long-password'],
        ['admin@example.test', '', 'long-password', 'long-password'],
        ['admin@example.test', 'Admin', 'short', 'short'],
        ['admin@example.test', 'Admin', 'long-password', 'different-password'],
        ['admin@example.test', 'Admin', '密'.repeat(25), '密'.repeat(25)] ]) {
        assert.throws(() => validateAdministratorInput(...values), error => !error.message.includes(values[2]))
    }
})

test('deletes exactly the selected backup and leaves live data and other files alone', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-delete-'))
    try {
        writeFileSync(join(directory, backupName), 'old snapshot')
        const otherName = 'coeer-db-20261022130000000-b1b2c3d4.dump'
        writeFileSync(join(directory, otherName), 'new snapshot')
        writeFileSync(join(directory, '.env'), 'keep configuration')
        writeFileSync(join(directory, backupName + '.partial'), 'keep incomplete backup')
        assert.deepEqual(deleteDatabaseBackup(directory, backupName), { deleted: backupName, bytes: 12, directory })
        assert.deepEqual(listDatabaseBackups(directory).map(backup => backup.name), [otherName])
        assert.equal(readFileSync(join(directory, otherName), 'utf8'), 'new snapshot')
        assert.equal(readFileSync(join(directory, '.env'), 'utf8'), 'keep configuration')
        assert.equal(readFileSync(join(directory, backupName + '.partial'), 'utf8'), 'keep incomplete backup')
        assert.throws(() => deleteDatabaseBackup(directory, backupName), /不存在/)
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('backup deletion rejects paths, partial names, wildcards and linked files or directories', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-delete-guards-'))
    try {
        const backups = join(directory, 'backups')
        mkdirSync(backups)
        writeFileSync(join(backups, backupName), 'keep backup')
        for (const invalid of [undefined, '', '*', '*.dump', '../' + backupName, '..\\' + backupName,
            join(backups, backupName), backupName + '.partial', backupName + '\n', '.env']) {
            assert.throws(() => deleteDatabaseBackup(backups, invalid), /完整/)
        }
        symlinkSync(backups, join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
        assert.throws(() => deleteDatabaseBackup(join(directory, 'linked'), backupName), /符号链接/)
        symlinkSync(backups, join(directory, backupName), process.platform === 'win32' ? 'junction' : 'dir')
        assert.throws(() => deleteDatabaseBackup(directory, backupName), /普通文件/)
        if (process.platform !== 'win32') {
            const files = join(directory, 'files')
            mkdirSync(files)
            symlinkSync(join(backups, backupName), join(files, backupName))
            assert.throws(() => deleteDatabaseBackup(files, backupName), /普通文件/)
        }
        assert.equal(readFileSync(join(backups, backupName), 'utf8'), 'keep backup')
        assert.throws(() => deleteDatabaseBackup(join(directory, 'absent'), backupName), /不存在/)
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('backup listing and deletion work without a database connection or credentials', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-offline-'))
    try {
        writeFileSync(join(directory, backupName), 'offline snapshot')
        const source = readFileSync(new URL('../deploy/database.mjs', import.meta.url), 'utf8')
        for (const action of ['db-backups', 'db-delete']) {
            const result = spawnSync(process.execPath, ['--input-type=module', '-'], { input: source, encoding: 'utf8',
                env: { ...process.env, DATABASE_URL: '', COEER_DB_REQUEST: JSON.stringify({ action, backupDirectory: directory, backup: backupName }) } })
            assert.equal(result.status, 0, result.stderr)
            const output = JSON.parse(result.stdout)
            assert.equal(output.directory, directory)
            if (action === 'db-backups') assert.equal(output.backups[0].name, backupName)
            else assert.equal(output.deleted, backupName)
        }
        assert.deepEqual(readdirSync(directory), [])
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('passes database credentials and libpq options through environment rather than command arguments', () => {
    const environment = postgresEnvironment('postgresql://demo%2Buser:p%40ss%3Aword@localhost:5433/coeer%20demo?sslmode=require&options=-c%20search_path%3Ddemo', {})
    assert.equal(environment.PGUSER, 'demo+user')
    assert.equal(environment.PGPASSWORD, 'p@ss:word')
    assert.equal(environment.PGDATABASE, 'coeer demo')
    assert.equal(environment.PGPORT, '5433')
    assert.equal(environment.PGSSLMODE, 'require')
    assert.equal(environment.PGOPTIONS, '-c search_path=demo')
    const clean = postgresEnvironment('postgresql://user:secret@localhost/coeer', { PGHOSTADDR: 'wrong-server', PGSERVICE: 'unrelated', PATH: '/usr/bin' })
    assert.equal(clean.PGHOSTADDR, undefined)
    assert.equal(clean.PGSERVICE, undefined)
    assert.equal(clean.PATH, '/usr/bin')
    assert.throws(() => postgresEnvironment('https://example.com'))
})

test('publishes only verified private backups and ignores partial/unrelated files when listing', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-backup-'))
    try {
        const calls = []
        const result = backupDatabase('postgresql://user:secret@localhost/coeer', directory, (tool, args, options) => {
            calls.push({ tool, args, options })
            if (tool === 'pg_dump') writeFileSync(args.at(-1), 'synthetic dump')
            return { status: 0 }
        })
        assert.equal(readFileSync(join(directory, result.name), 'utf8'), 'synthetic dump')
        assert.equal(calls[0].options.env.PGPASSWORD, 'secret')
        assert.ok(calls.every(call => !call.args.join(' ').includes('secret')))
        writeFileSync(join(directory, 'unfinished.dump.partial'), 'partial')
        writeFileSync(join(directory, 'unrelated.txt'), 'keep')
        const backups = listDatabaseBackups(directory)
        assert.equal(backups.length, 1)
        assert.equal(backups[0].name, result.name)
        if (process.platform !== 'win32') {
            assert.equal(statSync(directory).mode & 0o777, 0o700)
            assert.equal(statSync(join(directory, result.name)).mode & 0o777, 0o600)
        }
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('never leaves a completed backup when dumping or verification fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-failure-'))
    try {
        for (const failedTool of ['pg_dump', 'pg_restore']) {
            assert.throws(() => backupDatabase('postgresql://user:secret@localhost/coeer', directory, (tool, args) => {
                if (tool === 'pg_dump') writeFileSync(args.at(-1), 'unverified data')
                return { status: tool === failedTool ? 1 : 0 }
            }))
            assert.deepEqual(readdirSync(directory), [])
        }
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('backup listing is read-only and rejects linked directories', () => {
    const directory = mkdtempSync(join(tmpdir(), 'coeer-db-links-'))
    try {
        assert.deepEqual(listDatabaseBackups(join(directory, 'absent')), [])
        assert.deepEqual(readdirSync(directory), [])
        mkdirSync(join(directory, 'real'))
        symlinkSync(join(directory, 'real'), join(directory, 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
        assert.throws(() => listDatabaseBackups(join(directory, 'linked')))
        assert.throws(() => backupDatabase('postgresql://user:secret@localhost/coeer', join(directory, 'linked')))
    } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('a failed backup prevents migration execution and rejects unknown operations without writes', async () => {
    let queries = 0
    let backups = 0
    const pool = { query() { queries++; throw new Error('must not execute SQL') } }
    const backup = () => { backups++; throw new Error('backup failed') }
    await assert.rejects(runDatabaseOperation({ action: 'db-upgrade' }, pool, backup), /backup failed/)
    assert.equal(queries, 0)
    await assert.rejects(runDatabaseOperation({ action: 'unknown' }, pool, backup), /不支持/)
    assert.equal(backups, 1)
})
