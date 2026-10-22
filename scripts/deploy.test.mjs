import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createArchive, parseArgs, validateConfig } from './deploy.mjs'

const config = { host: 'aliyun', root: '/var/www/coeer', service: 'coeer.service', pnpm: '/opt/node/bin/pnpm', pnpmVersion: '10.33.4', port: 3000, previewPort: 13000 }
const backupName = 'coeer-db-20261022120000000-a1b2c3d4.dump'

test('rejects ambiguous actions, retired seeds and unsafe filenames before SSH', () => {
  for (const args of [
    ['--prepare', '--rollback'], ['--activate', '../current'], ['--delete', '../current'], ['--delete'],
    ['--list', '--delete', 'old-version'], ['--db-seed'], ['--db-seed', '--user', 'test@example.com'],
    ['--db-reset', '--keep-admin', 'admin@example.com'], ['--db-setup', '--password', 'secret'],
    ['--db-setup', '--execute'], ['--db-upgrade', '--execute'], ['--db-clear', '--execute', '--execute'],
    ['--db-delete'], ['--db-delete', backupName, '--db-backups'], ['--unknown'],
  ]) assert.throws(() => parseArgs(args))
  for (const invalid of ['', '../' + backupName, '..\\' + backupName, '/tmp/' + backupName, '*.dump', backupName + '.partial', backupName + '\n']) {
    assert.throws(() => parseArgs(['--db-delete', invalid]))
  }
  for (const change of [{ host: 'aliyun;id' }, { root: '/var/www/../etc' }, { service: 'nginx.service;id' }, { pnpm: '/opt/node/../bin/pnpm' }, { previewPort: 3000 }, { port: '3000' }]) {
    assert.throws(() => validateConfig({ ...config, ...change }))
  }
  assert.deepEqual(parseArgs(['--db-clear', '--execute']), { action: 'db-clear', dryRun: false, execute: true })
  assert.deepEqual(parseArgs(['--db-setup']), { action: 'db-setup', dryRun: false })
  assert.deepEqual(parseArgs(['--db-delete', backupName]), { action: 'db-delete', dryRun: false, backup: backupName })
  assert.deepEqual(parseArgs(['--delete', 'old-version']), { action: 'delete', dryRun: false, release: 'old-version' })
  assert.equal(validateConfig(config), config)
})

test('archives current working files but excludes secrets and local artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'coeer-archive-test-'))
  try {
    for (const name of ['src', 'public', 'scripts', 'deploy', 'dist', 'node_modules']) mkdirSync(join(directory, name))
    for (const name of ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'vite.config.ts']) writeFileSync(join(directory, name), '{}')
    writeFileSync(join(directory, 'src', 'current.tsx'), 'uncommitted UI version')
    mkdirSync(join(directory, 'src', '.coeer-local'))
    writeFileSync(join(directory, 'src', '.coeer-local', 'session.enc.json'), 'never-upload-this')
    for (const name of ['.env', 'src/.env.production', 'deploy/aliyun.local.json', 'public/private.pem', 'scripts/private.key', 'dist/private.js', 'node_modules/secret.js']) writeFileSync(join(directory, name), 'never-upload-this')
    const archive = join(directory, 'source.tar.gz')
    const digest = createArchive(directory, archive)
    assert.match(digest, /^[a-f0-9]{64}$/)
    assert.ok(readFileSync(archive).length > 0)
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    assert.equal(listing.status, 0)
    assert.match(listing.stdout, /src\/current.tsx/)
    assert.doesNotMatch(listing.stdout, /\.env|\.coeer-local|\.local\.json|private\.|node_modules|dist\//)
    const content = spawnSync('tar', ['-xOzf', archive, 'src/current.tsx'], { encoding: 'utf8' })
    assert.equal(content.stdout, 'uncommitted UI version')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('dry-run never contacts SSH, a database or a package registry and never prompts', () => {
  for (const args of [[], ['--list'], ['--delete', 'old-version'], ['--db-status'], ['--db-backup'],
    ['--db-backups'], ['--db-delete', backupName], ['--db-upgrade'], ['--db-setup'], ['--db-clear'], ['--db-clear', '--execute']]) {
    const result = spawnSync(process.execPath, ['scripts/deploy.mjs', ...args, '--dry-run'], { encoding: 'utf8', env: { ...process.env, PATH: '' } })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /dry-run/)
    if (args[0] === '--db-delete') assert.ok(result.stdout.includes(backupName))
  }
  for (const action of ['clear', 'setup']) {
    const result = spawnSync(process.execPath, ['scripts/database.mjs', action, '--dry-run'], { encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /dry-run/)
  }
})

test('setup rejects a noninteractive terminal without connecting or accepting a password argument', () => {
  for (const command of [['scripts/deploy.mjs', '--db-setup'], ['scripts/database.mjs', 'setup']]) {
    const result = spawnSync(process.execPath, command, { encoding: 'utf8', env: { ...process.env, PATH: '' } })
    assert.equal(result.status, 1)
    assert.doesNotMatch(result.stdout + result.stderr, /passwordHash|\$2[aby]\$/)
  }
})
