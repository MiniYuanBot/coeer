import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getEmbeddedSpaceServer } from '../../src/server/open-space/embedded'
import { spaceEnvironment } from '../../src/server/open-space/environment'

let directory: string | undefined
let running: Awaited<ReturnType<typeof getEmbeddedSpaceServer>> | undefined
afterEach(async () => {
    if (running) await running.close()
    running = undefined
    if (directory) rmSync(directory, { recursive: true, force: true })
    directory = undefined
    vi.unstubAllEnvs()
})

it('isolates booking configuration from the community database and disables official access by default in production', () => {
    const result = spaceEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'private-community-database',
        PORT: '3000',
        SESSION_SECRET: 'community-secret',
        OPENSPACE_DATABASE_PATH: '/persistent/booking.sqlite',
        OPENSPACE_APP_ORIGIN: 'https://community.example.com',
    })
    expect(result.DATABASE_PATH).toBe('/persistent/booking.sqlite')
    expect(result.APP_ORIGIN).toBe('https://community.example.com')
    expect(result.ADAPTER_MODE).toBe('official-disabled')
    expect(result).not.toHaveProperty('DATABASE_URL')
    expect(result).not.toHaveProperty('SESSION_SECRET')
    expect(result).not.toHaveProperty('PORT')
})

it('starts exactly one embedded engine and serves its API without a sibling project or second UI', async () => {
    directory = mkdtempSync(join(tmpdir(), 'coeer-space-embedded-'))
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000')
    vi.stubEnv('OPENSPACE_DATABASE_PATH', join(directory, 'booking.sqlite'))
    vi.stubEnv('OPENSPACE_ADAPTER_MODE', 'mock')
    const first = getEmbeddedSpaceServer()
    expect(getEmbeddedSpaceServer()).toBe(first)
    running = await first
    expect(new URL(running.url).hostname).toBe('127.0.0.1')
    const configuration = await (await fetch(running.url + '/api/config')).json()
    expect(configuration.demo).toBe(true)
    expect(configuration.adapter).toBe('mock')
    const spaces = await (await fetch(running.url + '/api/spaces')).json()
    expect(spaces.length).toBe(3)
    expect((await fetch(running.url + '/')).status).toBe(404)
})
