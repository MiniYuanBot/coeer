import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/server/open-space/app'
import { Accounts } from '../../src/server/open-space/accounts'
import { forwardSpaceRequest } from '../../src/server/open-space/gateway'
import { AdapterError, type CreateCommand, type OfficialAdapter, type OfficialRecord, type PublicationGrant, type SourceSpace } from '../../src/server/open-space/adapters/adapter'
import { addDays, today } from '../../src/shared/open-space/domain'
import type { Availability, Booking, Slot } from '../../src/shared/open-space/domain'
import { createTestDatabase, databaseUrl } from '../support/postgres'

const origin = 'http://localhost:3000'
const secret = 'synthetic-upstream-community-identity-secret'
const student = { id: 'upstream-coeer-student', email: '2026000001@stu.pku.edu.cn', name: '上游规则测试学生', role: 'student' }

function room(id: string, stepMinutes = 30): SourceSpace {
    return {
        id: `synthetic-meeting-${id}`, officialId: id, module: 'meeting', name: `合成会议室 ${id}`,
        location: '合成测试地点', description: '不访问真实预约网站', capacity: 12, amenities: ['白板'],
        enabled: true, permission: 'allowed', metadata: { reservationCost: 0 },
        policy: { kind: 'meeting', approval: false, stepMinutes, maxMinutes: 0, rulesVerified: true, rulesSource: 'upstream' },
    }
}

/** Real PostgreSQL and services; all upstream I/O stays inside this synthetic adapter. */
class SyntheticOfficialAdapter implements OfficialAdapter {
    readonly mode = 'official' as const
    readonly rulesSource = 'upstream' as const
    readonly catalogComplete = true
    readonly defaultHorizon = 1
    catalog = [room('one'), room('two', 15), room('three')]
    availabilityCalls: Array<{ spaceId: string; date: string }> = []
    createCalls: CreateCommand[] = []
    records = new Map<string, OfficialRecord>()
    failAvailability = false

    async listSpaces() { return this.catalog }
    publication(spaceId: string): PublicationGrant | undefined {
        const source = this.catalog.find(value => value.id === spaceId)
        if (!source || source.permission !== 'allowed') return undefined
        return { module: 'meeting', officialId: source.officialId, approvalRef: 'synthetic-upstream-permission',
            expiresAt: '2099-12-31T00:00:00Z', name: source.name, location: source.location,
            description: source.description, capacity: source.capacity, amenities: source.amenities }
    }
    diagnostics() { return { writeConfigured: true, connector: { authentication: 'healthy' } } }
    async availability(spaceId: string, date: string) {
        this.availabilityCalls.push({ spaceId, date })
        if (this.failAvailability) throw new AdapterError('NETWORK')
        const source = this.catalog.find(value => value.id === spaceId)!
        const step = source.policy.stepMinutes
        // The observed grid starts at 08:15, rather than on a multiple of 30 since midnight.
        const slots: Slot[] = Array.from({ length: 600 / step }, (_, index) => ({
            kind: 'meeting', start: 495 + index * step, end: 495 + (index + 1) * step, state: 'available',
        }))
        return { slots, includedRefs: [], observedAt: Date.now() }
    }
    async create(command: CreateCommand) {
        this.createCalls.push(command)
        const ref = `synthetic-${randomUUID()}`
        this.records.set(ref, { ...command, ref, status: 'confirmed', identityVerified: true })
        return { ref }
    }
    async get(ref: string) { return this.records.get(ref) ?? null }
    async cancel(ref: string) { this.records.get(ref)!.status = 'cancelled' }
}

let scope: ReturnType<typeof createTestDatabase>
let context: Awaited<ReturnType<typeof createApp>>
let adapter: SyntheticOfficialAdapter
let server: Server | undefined
let backend: string

beforeEach(async () => {
    scope = createTestDatabase('upstream')
    await scope.initialize()
    adapter = new SyntheticOfficialAdapter()
    context = await createApp({ databaseUrl, databaseSchema: scope.name, adapter, adapterMode: 'official',
        communityIdentitySecret: secret, environment: 'staging', origin, horizon: 1, staleMs: 1000, serveClient: false })
    await new Accounts(context.db).save('2026000001')
    server = await new Promise<Server>(resolve => {
        const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Synthetic upstream COEER service failed to listen')
    backend = `http://127.0.0.1:${address.port}`
})

afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    server = undefined
    if (context) await context.db.close()
    if (scope) await scope.close()
})

function call(path: string, init: RequestInit = {}) {
    return forwardSpaceRequest(new Request(origin + '/api/open-space' + path, init), student, backend, secret)
}
async function submit(input: unknown, key: string) {
    const session = await (await call('/auth/me')).json()
    return call('/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin,
        'X-CSRF-Token': session.csrf, 'Idempotency-Key': key }, body: JSON.stringify(input) })
}
async function finishJobs() {
    for (let index = 0; index < 8; index++) {
        await context.db.run("UPDATE jobs SET run_at=0 WHERE state='pending'")
        if (!await context.service.runOne()) return
    }
    throw new Error('Synthetic upstream jobs did not settle')
}

describe('COEER follows official upstream booking rules', () => {
    it('publishes a newly discovered fourth allowed room and revokes rooms the upstream denies', async () => {
        expect(await context.service.spaces()).toHaveLength(3)
        const fourth = room('fourth')
        adapter.catalog.push(fourth, { ...room('denied'), permission: 'denied' })
        adapter.catalog[0].permission = 'denied'
        await context.service.sync()
        const visible = await context.service.spaces()
        expect(visible.map(value => value.id)).toContain(fourth.id)
        expect(visible.map(value => value.id)).not.toContain('synthetic-meeting-one')
        expect(visible.map(value => value.id)).not.toContain('synthetic-meeting-denied')
        expect(await context.service.space(fourth.id)).toMatchObject({ published: 1, bookable: 1 })
        expect(await context.service.space('synthetic-meeting-one')).toMatchObject({ published: 0, bookable: 0, permission: 'denied' })
        expect(await context.service.space('synthetic-meeting-denied')).toMatchObject({ published: 0, bookable: 0 })
    })

    it('exposes no local date limit and coalesces uncached queries 90 days beyond the warm cache into one PostgreSQL snapshot', async () => {
        const config = await (await call('/config')).json()
        expect(config).toMatchObject({ adapter: 'official', rulesSource: 'upstream', horizon: null })
        const date = addDays(today(), 90)
        const spaceId = 'synthetic-meeting-one'
        expect(await context.db.get('SELECT 1 FROM snapshots WHERE space_id=? AND date=?', spaceId, date)).toBeUndefined()
        const responses = await Promise.all(Array.from({ length: 8 }, () => call(`/spaces/${spaceId}/availability?date=${date}`)))
        expect(responses.map(value => value.status)).toEqual(Array(8).fill(200))
        const results = await Promise.all(responses.map(value => value.json() as Promise<Availability>))
        expect(results.every(value => !value.stale && value.slots[0].start === 495)).toBe(true)
        expect(adapter.availabilityCalls.filter(value => value.spaceId === spaceId && value.date === date)).toHaveLength(1)
        const snapshot = await context.db.get<{ date: string; slots: string }>('SELECT date,slots FROM snapshots WHERE space_id=? AND date=?', spaceId, date)
        expect(snapshot?.date).toBe(date)
        expect(JSON.parse(snapshot!.slots)[0]).toMatchObject({ start: 495, end: 525, state: 'available' })
    })

    it.each([
        ['one', 180],
        ['two', 135],
    ] as const)('accepts the real offset grid for room %s and %i-minute bookings while retaining whitelist and idempotency', async (id, duration) => {
        const input = { spaceId: `synthetic-meeting-${id}`, date: addDays(today(), 45), start: 495,
            end: 495 + duration, quantity: 1, purpose: '官网规则合成验收' }
        const key = `upstream-offset-grid-${id}-${duration}`
        const first = await submit(input, key)
        expect(first.status).toBe(201)
        const booking = await first.json() as Booking
        const repeat = await submit(input, key)
        expect(repeat.status).toBe(201)
        expect((await repeat.json()).id).toBe(booking.id)
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
        await finishJobs()
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.createCalls[0]).toMatchObject({ start: 495, end: 495 + duration, date: input.date })
        expect((await context.service.booking(booking.id)).status).toBe('confirmed')
        await new Accounts(context.db).remove('2026000001')
        const forbidden = await submit({ ...input, date: addDays(today(), 46) }, key + '-forbidden')
        expect(forbidden.status).toBe(403)
        expect((await forbidden.json()).error.code).toBe('BOOKING_FORBIDDEN')
        expect(adapter.createCalls).toHaveLength(1)
    })

    it('does not advertise or create a bookable slot when refreshing an expired official snapshot fails', async () => {
        const date = addDays(today(), 45), spaceId = 'synthetic-meeting-one'
        await context.service.availability(spaceId, date)
        await context.db.run('UPDATE snapshots SET observed_at=0 WHERE space_id=? AND date=?', spaceId, date)
        adapter.failAvailability = true
        await expect(context.service.availability(spaceId, date)).rejects.toMatchObject({ code: 'NETWORK' })
        const response = await submit({ spaceId, date, start: 495, end: 675, quantity: 1, purpose: '不可伪造可预约状态' }, 'upstream-failed-refresh')
        expect(response.status).toBe(409)
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(0)
        expect(adapter.createCalls).toHaveLength(0)
        expect((await context.db.get<{ observed_at: number }>('SELECT observed_at FROM snapshots WHERE space_id=? AND date=?', spaceId, date))?.observed_at).toBe(0)
    })
})
