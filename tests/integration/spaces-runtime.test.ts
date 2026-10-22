import { afterEach, expect, it, vi } from 'vitest'
import { getEmbeddedSpaceServer, startEmbeddedSpaceServer } from '../../src/server/open-space/embedded'
import { spaceEnvironment } from '../../src/server/open-space/environment'
import { communityIdentitySecret, signCommunityIdentity } from '../../src/server/open-space/coeer-identity'
import { createTestDatabase, databaseUrl } from '../support/postgres'
import { DB } from '../../src/server/open-space/db'
import { createApp } from '../../src/server/open-space/app'
import { BookingService } from '../../src/server/open-space/service'
import { addDays, today } from '../../src/shared/open-space/domain'
import { OfficialHTTP } from '../../src/server/open-space/adapters/official/http'
import { parseOfficialConfig } from '../../src/server/open-space/adapters/official/config'
import { AdapterError } from '../../src/server/open-space/adapters/adapter'
import { runtime } from '../../src/server/open-space/runtime'

let scope: ReturnType<typeof createTestDatabase> | undefined
let running: Awaited<ReturnType<typeof getEmbeddedSpaceServer>> | undefined
const connections: DB[] = []
afterEach(async () => {
    if (running) await running.close()
    running = undefined
    for (const connection of connections.splice(0)) await connection.close()
    if (scope) await scope.close()
    scope = undefined
    vi.unstubAllEnvs()
})

it('rolls back failed PostgreSQL mutations and keeps nested work on the same transaction', async () => {
    scope = createTestDatabase('rollback')
    await scope.initialize()
    const db = await DB.open(databaseUrl, scope.name)
    connections.push(db)
    await expect(db.tx(async () => {
        await db.set('paused', 'true')
        await db.tx(async () => {
            await db.run("INSERT INTO booking_allowlist VALUES(?,?,?)", 'invalid-student-id', '', Date.now())
        })
    })).rejects.toMatchObject({ code: '23514' })
    expect(await db.setting('paused')).toBe('false')
    expect(await db.all('SELECT * FROM booking_allowlist')).toEqual([])
})

it('serializes reservation transactions across independent PostgreSQL pools', async () => {
    scope = createTestDatabase('concurrency')
    await scope.initialize()
    const first = await DB.open(databaseUrl, scope.name)
    const second = await DB.open(databaseUrl, scope.name)
    connections.push(first, second)
    await first.set('concurrent_count', '0')
    await Promise.all(Array.from({ length: 8 }, (_, index) => (index % 2 ? first : second).tx(async () => {
        const db = index % 2 ? first : second
        const value = Number(await db.setting('concurrent_count'))
        await db.set('concurrent_count', String(value + 1))
    })))
    expect(await second.setting('concurrent_count')).toBe('8')
    await expect(DB.open(databaseUrl, 'public')).rejects.toThrow('Invalid reservation PostgreSQL schema')
    await first.run('INSERT INTO schema_version VALUES(999)')
    await expect(DB.open(databaseUrl, scope.name)).rejects.toThrow('Reservation schema requires a newer application')
    expect(await second.setting('concurrent_count')).toBe('8')
})

it('keeps one worker claim across PostgreSQL connections while an upstream operation is in flight', async () => {
    scope = createTestDatabase('worker')
    await scope.initialize()
    const context = await createApp({ databaseUrl, databaseSchema: scope.name, demo: true, serveClient: false })
    connections.push(context.db)
    const other = await DB.open(databaseUrl, scope.name)
    connections.push(other)
    const worker = new BookingService(other, context.adapter)
    const user = (await context.db.get<{ id: string }>("SELECT id FROM users WHERE role='user'"))!
    const booking = await context.service.create(user.id, {
        spaceId: 'mock-meeting-harbor', date: addDays(today(), 1), start: 600, end: 660, quantity: 1, purpose: '多连接工人验证',
    }, 'postgres-worker-claim')
    let started!: () => void
    let release!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const gate = new Promise<void>(resolve => { release = resolve })
    const create = context.adapter.create.bind(context.adapter)
    const intercepted = vi.spyOn(context.adapter, 'create').mockImplementation(async (...args) => {
        started()
        await gate
        return create(...args)
    })
    const active = context.service.runOne()
    try {
        await ready
        expect(await worker.runOne()).toBe(false)
    } finally {
        release()
        await active
        intercepted.mockRestore()
    }
    expect((await other.get<{ attempts: number }>("SELECT attempts FROM jobs WHERE type='create' AND booking_id=?", booking.id))?.attempts).toBe(1)
    expect((await other.get<{ count: number }>("SELECT COUNT(*) AS count FROM adapter_calls WHERE operation='create' AND request_id=?", booking.id))?.count).toBe(1)
    await other.run("UPDATE jobs SET state='running',locked_at=? WHERE type='reconcile' AND booking_id=?", Date.now() - 61000, booking.id)
    await Promise.all([context.service.recoverExpired(), worker.recoverExpired()])
    expect((await other.get<{ count: number }>("SELECT COUNT(*) AS count FROM audit WHERE action='job.recovered'"))?.count).toBe(1)
    expect((await other.get<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE type='reconcile' AND state='pending' AND booking_id=?", booking.id))?.count).toBe(1)
    expect((await context.service.booking(booking.id)).status).toBe('uncertain')
})

it('awaits the asynchronous PostgreSQL authorization guard before sending any official request', async () => {
    const configuration = parseOfficialConfig({ baseURL: 'https://booking.invalid/meeting/', account: { alias: 'test' }, minIntervalMs: 0 })
    const fetcher = vi.fn<typeof fetch>()
    const session = await new OfficialHTTP(configuration, async () => ({}), fetcher).session()
    await expect(session.request('create', {}, {}, { beforeSend: async () => {
        await Promise.resolve()
        throw new AdapterError('AUTHORIZATION_REQUIRED')
    } })).rejects.toMatchObject({ code: 'AUTHORIZATION_REQUIRED' })
    expect(fetcher).not.toHaveBeenCalled()
})

it('shares PostgreSQL while isolating reservation tables and selects the same official adapter in development and production', () => {
    const result = spaceEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://test.invalid/community',
        PORT: '3000',
        SESSION_SECRET: 'community-secret',
        BOOKING_DB_SCHEMA: 'coeer_spaces',
        BOOKING_ALLOWED_ORIGIN: 'https://community.example.com',
    })
    expect(result.DATABASE_URL).toBe('postgresql://test.invalid/community')
    expect(result.BOOKING_DB_SCHEMA).toBe('coeer_spaces')
    expect(result.BOOKING_ALLOWED_ORIGIN).toBe('https://community.example.com')
    expect(result.BOOKING_DATA_SOURCE).toBe('official')
    expect(result).not.toHaveProperty('DATABASE_PATH')
    expect(result).not.toHaveProperty('SESSION_SECRET')
    expect(result).not.toHaveProperty('PORT')
    const development = spaceEnvironment({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://test.invalid/community' })
    expect(development.BOOKING_DATA_SOURCE).toBe(result.BOOKING_DATA_SOURCE)
    expect(runtime(development)).toMatchObject({ mode: 'official', environment: 'staging' })
    expect(runtime(result)).toMatchObject({ mode: 'official', environment: 'production' })
    expect(spaceEnvironment({ NODE_ENV: 'test', BOOKING_DATA_SOURCE: 'mock' }).BOOKING_DATA_SOURCE).toBe('mock')
})

it('starts exactly one embedded engine and serves its API without a sibling project or second UI', async () => {
    scope = createTestDatabase('runtime')
    await scope.initialize()
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000')
    vi.stubEnv('DATABASE_URL', databaseUrl!)
    vi.stubEnv('BOOKING_DB_SCHEMA', scope.name)
    vi.stubEnv('BOOKING_DATA_SOURCE', 'mock')
    await expect(getEmbeddedSpaceServer()).rejects.toThrow('has not started')
    const first = startEmbeddedSpaceServer()
    expect(getEmbeddedSpaceServer()).toBe(first)
    running = await first
    expect(new URL(running.url).hostname).toBe('127.0.0.1')
    const headers = { 'x-coeer-identity': signCommunityIdentity({ id: 'runtime-student', email: '2026000001@stu.pku.edu.cn', name: '运行测试', role: 'student' }, communityIdentitySecret()) }
    const configuration = await (await fetch(running.url + '/api/config', { headers })).json()
    expect(configuration.demo).toBe(true)
    expect(configuration.adapter).toBe('mock')
    const spaces = await (await fetch(running.url + '/api/spaces', { headers })).json()
    expect(spaces.length).toBe(3)
    expect((await fetch(running.url + '/')).status).toBe(404)
})
