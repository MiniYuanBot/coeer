import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { backupDatabase, listDatabaseBackups, postgresEnvironment, runDatabaseOperation } from '../deploy/database.mjs'

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
