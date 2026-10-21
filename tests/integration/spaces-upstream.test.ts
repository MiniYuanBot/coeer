import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { createApp } from '../../src/server/open-space/app'
import { Accounts } from '../../src/server/open-space/accounts'
import { BookingService } from '../../src/server/open-space/service'
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
    readonly defaultHorizon = 7
    readonly syncIntervalMs = 300000
    catalog = [room('one'), room('two', 15), room('three')]
    availabilityCalls: Array<{ spaceId: string; date: string }> = []
    listCalls = 0
    getCalls: string[] = []
    createCalls: CreateCommand[] = []
    records = new Map<string, OfficialRecord>()
    failAvailability = false

    async listSpaces() { this.listCalls++; return this.catalog }
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
        const source = this.catalog.find(value => value.id === command.spaceId)!
        const step = source.policy.stepMinutes
        if ((command.start - 495) % step || (command.end - 495) % step || command.end > 1095)
            throw new AdapterError('CONFLICT')
        const ref = `synthetic-${randomUUID()}`
        this.records.set(ref, { ...command, ref, status: 'confirmed', identityVerified: true })
        return { ref }
    }
    async get(ref: string) { this.getCalls.push(ref); return this.records.get(ref) ?? null }
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
        communityIdentitySecret: secret, environment: 'staging', origin, bookingWaitMs: 3000, serveClient: false })
    await new Accounts(context.db).save('2026000001')
    adapter.availabilityCalls = []
    adapter.listCalls = 0
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

    it('reads missing and expired snapshots from PostgreSQL without making any upstream request', async () => {
        const config = await (await call('/config')).json()
        expect(config).toMatchObject({ adapter: 'official', rulesSource: 'upstream', horizon: 7 })
        const date = addDays(today(), 3)
        const spaceId = 'synthetic-meeting-one'
        await context.db.run('DELETE FROM snapshots WHERE space_id=? AND date=?', spaceId, date)
        expect(await context.db.get('SELECT 1 FROM snapshots WHERE space_id=? AND date=?', spaceId, date)).toBeUndefined()
        const responses = await Promise.all(Array.from({ length: 8 }, () => call(`/spaces/${spaceId}/availability?date=${date}`)))
        expect(responses.map(value => value.status)).toEqual(Array(8).fill(200))
        const results = await Promise.all(responses.map(value => value.json() as Promise<Availability>))
        expect(results.every(value => value.stale && value.slots.length === 0)).toBe(true)
        expect(await context.db.get('SELECT 1 FROM snapshots WHERE space_id=? AND date=?', spaceId, date)).toBeUndefined()
        const expired = addDays(today(), 7)
        await context.db.run('UPDATE snapshots SET observed_at=0 WHERE space_id=? AND date=?', spaceId, expired)
        adapter.failAvailability = true
        const stale = await (await call(`/spaces/${spaceId}/availability?date=${expired}`)).json() as Availability
        expect(stale.stale).toBe(true)
        expect(stale.slots.length).toBeGreaterThan(0)
        expect(stale.slots.every(value => value.state === 'unknown')).toBe(true)
        expect(adapter.availabilityCalls).toHaveLength(0)
        expect(adapter.listCalls).toBe(0)
        expect(adapter.createCalls).toHaveLength(0)
        expect(adapter.getCalls).toHaveLength(0)
        expect((await context.db.get<{ observed_at: number }>('SELECT observed_at FROM snapshots WHERE space_id=? AND date=?', spaceId, expired))?.observed_at).toBe(0)
    })

    it('reads the persisted catalog and details even when the upstream adapter has no in-memory catalog', async () => {
        adapter.catalog = []
        const catalog = await (await call('/spaces')).json()
        expect(catalog).toHaveLength(3)
        const detail = await call('/spaces/synthetic-meeting-one')
        expect(detail.status).toBe(200)
        expect((await detail.json()).name).toBe('合成会议室 one')
        expect(adapter.listCalls).toBe(0)
        expect(adapter.availabilityCalls).toHaveLength(0)
    })

    it('synchronizes all eight dates from today through day seven and supports a configured ten-day horizon', async () => {
        const dates = await context.db.all<{ date: string }>('SELECT DISTINCT date FROM snapshots ORDER BY date')
        expect(dates.map(value => value.date)).toEqual(Array.from({ length: 8 }, (_, index) => addDays(today(), index)))
        const configured = new BookingService(context.db, adapter, 10, 180000, undefined, 3000)
        await configured.sync()
        const expanded = await context.db.all<{ date: string }>('SELECT DISTINCT date FROM snapshots ORDER BY date')
        expect(expanded.map(value => value.date)).toEqual(Array.from({ length: 11 }, (_, index) => addDays(today(), index)))
        expect(adapter.availabilityCalls.some(value => value.date === addDays(today(), 10))).toBe(true)
    })

    it('schedules the background synchronization at five minutes without a page requesting it', async () => {
        await context.db.set('last_sync_scheduled', String(Date.now() - 299000))
        await context.db.set('last_reconcile_scheduled', String(Date.now()))
        await context.service.schedule()
        expect(await context.db.get("SELECT id FROM jobs WHERE type='sync' AND state='pending'")).toBeUndefined()
        await context.db.set('last_sync_scheduled', String(Date.now() - 300001))
        await context.service.schedule()
        expect((await context.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM jobs WHERE type='sync' AND state='pending'"))?.count).toBe(1)
        expect(adapter.listCalls).toBe(0)
        expect(adapter.availabilityCalls).toHaveLength(0)
        expect(await context.service.runOne({ lane: 'sync' })).toBe(true)
        expect(adapter.listCalls).toBe(1)
        const dates = [...new Set(adapter.availabilityCalls.map(value => value.date))].sort()
        expect(dates).toEqual(Array.from({ length: 8 }, (_, index) => addDays(today(), index)))
    })

    it.each([
        ['one', 180],
        ['two', 135],
    ] as const)('accepts the real offset grid for room %s and %i-minute bookings while retaining whitelist and idempotency', async (id, duration) => {
        const input = { spaceId: `synthetic-meeting-${id}`, date: addDays(today(), 7), start: 495,
            end: 495 + duration, quantity: 1, purpose: '官网规则合成验收' }
        const key = `upstream-offset-grid-${id}-${duration}`
        const first = await submit(input, key)
        expect(first.status).toBe(201)
        const booking = await first.json() as Booking
        expect(booking.status).toBe('confirmed')
        const repeat = await submit(input, key)
        expect(repeat.status).toBe(201)
        expect((await repeat.json()).id).toBe(booking.id)
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.createCalls[0]).toMatchObject({ start: 495, end: 495 + duration, date: input.date })
        expect((await context.service.booking(booking.id)).status).toBe('confirmed')
        await new Accounts(context.db).remove('2026000001')
        const forbidden = await submit({ ...input, date: addDays(today(), 6) }, key + '-forbidden')
        expect(forbidden.status).toBe(403)
        expect((await forbidden.json()).error.code).toBe('BOOKING_FORBIDDEN')
        expect(adapter.createCalls).toHaveLength(1)
    })

    it('does not submit an old queued booking after the configured booking horizon is reduced', async () => {
        const user = (await new Accounts(context.db).communityUser(student))!
        const expanded = new BookingService(context.db, adapter, 10, 180000, undefined, 3000)
        const booking = await expanded.create(user.id, { spaceId: 'synthetic-meeting-one', date: addDays(today(), 8),
            start: 495, end: 675, quantity: 1, purpose: '缩短范围前已排队' }, 'upstream-reduced-horizon', {
            applicantName: user.name, studentId: user.studentId!,
        })
        expect(booking.status).toBe('queued')
        expect(await context.service.runOne({ lane: 'booking', bookingId: booking.id })).toBe(true)
        expect((await context.service.booking(booking.id)).status).toBe('failed')
        expect(adapter.createCalls).toHaveLength(0)
        expect(adapter.availabilityCalls).toHaveLength(0)
        expect(adapter.getCalls).toHaveLength(0)
        expect(adapter.listCalls).toBe(0)
    })

    it('rejects a new booking locally when booking execution is paused', async () => {
        await context.db.set('paused', 'true')
        const response = await submit({ spaceId: 'synthetic-meeting-one', date: addDays(today(), 1),
            start: 495, end: 675, quantity: 1, purpose: '暂停时不能提交' }, 'upstream-paused-locally')
        expect(response.status).toBe(409)
        expect((await response.json()).error.code).toBe('BOOKING_PAUSED')
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(0)
        expect(adapter.createCalls).toHaveLength(0)
        expect(adapter.availabilityCalls).toHaveLength(0)
        expect(adapter.getCalls).toHaveLength(0)
        expect(adapter.listCalls).toBe(0)
    })

    it('rejects day eight locally without contacting the official service', async () => {
        const response = await submit({ spaceId: 'synthetic-meeting-one', date: addDays(today(), 8), start: 495,
            end: 675, quantity: 1, purpose: '超出一星期范围' }, 'upstream-outside-week')
        expect(response.status).toBe(400)
        expect((await response.json()).error.code).toBe('DATE_RANGE')
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(0)
        expect(adapter.createCalls).toHaveLength(0)
        expect(adapter.availabilityCalls).toHaveLength(0)
        expect(adapter.getCalls).toHaveLength(0)
        expect(adapter.listCalls).toBe(0)
    })
})
