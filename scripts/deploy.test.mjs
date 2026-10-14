import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createArchive, parseArgs, validateConfig } from './deploy.mjs'

const config = { host: 'aliyun', root: '/var/www/coeer', service: 'coeer.service', pnpm: '/opt/node/bin/pnpm', pnpmVersion: '10.33.4', port: 3000, previewPort: 13000 }

test('rejects ambiguous actions and shell/path injection before SSH', () => {
  assert.throws(() => parseArgs(['--prepare', '--rollback']))
  assert.throws(() => parseArgs(['--activate', '../current']))
  assert.throws(() => parseArgs(['--unknown']))
  for (const change of [{ host: 'aliyun;id' }, { root: '/var/www/../etc' }, { service: 'nginx.service;id' }, { pnpm: '/opt/node/../bin/pnpm' }, { previewPort: 3000 }, { port: '3000' }]) {
    assert.throws(() => validateConfig({ ...config, ...change }))
  }
  assert.equal(parseArgs(['--prepare', '--dry-run']).action, 'prepare')
  assert.equal(validateConfig(config), config)
})

test('archives current working files but excludes secrets and local artifacts', () => {
  const directory = mkdtempSync(join(tmpdir(), 'coeer-archive-test-'))
  try {
    for (const name of ['src', 'public', 'scripts', 'deploy', 'dist', 'node_modules']) mkdirSync(join(directory, name))
    for (const name of ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'vite.config.ts']) writeFileSync(join(directory, name), '{}')
    writeFileSync(join(directory, 'src', 'current.tsx'), 'uncommitted UI version')
    for (const name of ['.env', 'src/.env.production', 'deploy/aliyun.local.json', 'public/private.pem', 'scripts/private.key', 'dist/private.js', 'node_modules/secret.js']) writeFileSync(join(directory, name), 'never-upload-this')
    const archive = join(directory, 'source.tar.gz')
    const digest = createArchive(directory, archive)
    assert.match(digest, /^[a-f0-9]{64}$/)
    assert.ok(readFileSync(archive).length > 0)
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    assert.equal(listing.status, 0)
    assert.match(listing.stdout, /src\/current.tsx/)
    assert.doesNotMatch(listing.stdout, /\.env|\.local\.json|private\.|node_modules|dist\//)
    const content = spawnSync('tar', ['-xOzf', archive, 'src/current.tsx'], { encoding: 'utf8' })
    assert.equal(content.stdout, 'uncommitted UI version')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('dry-run never contacts SSH or a package registry', () => {
  const result = spawnSync(process.execPath, ['scripts/deploy.mjs', '--dry-run'], { encoding: 'utf8', env: { ...process.env, PATH: '' } })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /dry-run/)
})
