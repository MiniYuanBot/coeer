import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const database = vi.hoisted(() => ({ query: vi.fn(), on: vi.fn() }))
vi.mock('pg', () => ({ Pool: class { query = database.query; on = database.on } }))
vi.mock('../src/server/config', () => ({ env: { DATABASE_URL: 'postgresql://private-credentials' } }))

import { readinessResponse } from '../src/server/utils/health'

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('COEER_RELEASE_ID', 'test-release') })
afterEach(() => vi.unstubAllEnvs())

it('reports the release only when the required database schema is usable', async () => {
    database.query.mockResolvedValueOnce({ rows: [] })
    const response = await readinessResponse()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'ok', release: 'test-release' })
})

it('fails readiness for missing schema without exposing SQL, credentials or user data', async () => {
    database.query.mockRejectedValueOnce(new Error('relation notifications missing: private-credentials'))
    const response = await readinessResponse()
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'unavailable' })
})
