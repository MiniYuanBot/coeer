import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { createApp, type AppOptions } from '../../src/server/open-space/app'
import { Accounts } from '../../src/server/open-space/accounts'
import { forwardSpaceRequest } from '../../src/server/open-space/gateway'
import { AdapterError, type CreateCommand, type OfficialAdapter, type OfficialRecord, type PublicationGrant, type SourceSpace } from '../../src/server/open-space/adapters/adapter'
import { addDays, today, type Booking, type Slot } from '../../src/shared/open-space/domain'
import { createTestDatabase, databaseUrl } from '../support/postgres'

const origin = 'http://localhost:3000'
const secret = 'synthetic-interactive-booking-identity-secret'
const student = { id: 'interactive-student', email: '2026000001@stu.pku.edu.cn', name: '提交测试学生', role: 'student' }
function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>(done => { resolve = done })
    return { promise, resolve }
}

/** Its calls are entirely synthetic; only the COEER persistence and HTTP boundary are real. */
class InteractiveOfficialAdapter implements OfficialAdapter {
    readonly mode = 'official' as const
    readonly rulesSource = 'upstream' as const
    readonly defaultHorizon = 7
    readonly operationTimeoutMs = 10000
    readonly syncIntervalMs = 300000
    readonly catalogComplete = true
    readonly source: SourceSpace = {
        id: 'synthetic-interactive-room', officialId: 'interactive-room', module: 'meeting', name: '合成交互会议室',
        location: '合成地点', description: '不访问校园官网', capacity: 8, amenities: [], enabled: true, permission: 'allowed',
        metadata: { reservationCost: 0 },
        policy: { kind: 'meeting', stepMinutes: 30, maxMinutes: 0, approval: false, rulesVerified: true, rulesSource: 'upstream' },
    }
    records = new Map<string, OfficialRecord>()
    createCalls: CreateCommand[] = []
    getCalls: string[] = []
    availabilityCalls = 0
    listCalls = 0
    saveCalls = 0
    createGate?: ReturnType<typeof deferred>
    getGate?: ReturnType<typeof deferred>
    syncGate?: ReturnType<typeof deferred>
    createStarted = deferred()
    getStarted = deferred()
    syncStarted = deferred()
    createFailure?: 'CONFLICT' | 'TIMEOUT'
    returnReferenceOnFailure = false
    finalStatus: OfficialRecord['status'] = 'confirmed'
    onInitialized?: (command: CreateCommand, ref: string) => Promise<void>

    publication(): PublicationGrant {
        return { module: 'meeting', officialId: this.source.officialId, approvalRef: 'synthetic-upstream',
            expiresAt: '2099-12-31T00:00:00Z', name: this.source.name, location: this.source.location,
            description: this.source.description, capacity: this.source.capacity, amenities: [] }
    }
    diagnostics() { return { writeConfigured: true, connector: { authentication: 'healthy' } } }
    async listSpaces() {
        this.listCalls++
        this.syncStarted.resolve()
        await this.syncGate?.promise
        return [this.source]
    }
    async availability() {
        this.availabilityCalls++
        const slots: Slot[] = Array.from({ length: 20 }, (_, index) => ({
            kind: 'meeting', start: 495 + index * 30, end: 525 + index * 30, state: 'available',
        }))
        return { slots, includedRefs: [], observedAt: Date.now() }
    }
    async create(command: CreateCommand) {
        this.createCalls.push(command)
        const ref = `synthetic-${randomUUID()}`
        await this.onInitialized?.(command, ref)
        this.createStarted.resolve()
        await this.createGate?.promise
        if (this.createFailure === 'CONFLICT') throw new AdapterError('CONFLICT')
        this.saveCalls++
        this.records.set(ref, { ...command, ref, status: this.finalStatus, identityVerified: true })
        if (this.createFailure === 'TIMEOUT') throw new AdapterError('TIMEOUT', this.returnReferenceOnFailure ? ref : undefined)
        return { ref }
    }
    async get(ref: string) {
        this.getCalls.push(ref)
        this.getStarted.resolve()
        await this.getGate?.promise
        return this.records.get(ref) ?? null
    }
    async cancel(ref: string) { this.records.get(ref)!.status = 'cancelled' }
}

let scope: ReturnType<typeof createTestDatabase>
let context: Awaited<ReturnType<typeof createApp>>
let adapter: InteractiveOfficialAdapter
let server: Server | undefined
let backend: string
let stopWorker: (() => Promise<void>) | undefined

async function startApplication(extra: Partial<AppOptions> = {}) {
    context = await createApp({ databaseUrl, databaseSchema: scope.name, adapter, adapterMode: 'official',
        communityIdentitySecret: secret, environment: 'staging', origin, bookingWaitMs: 2000, serveClient: false, ...extra })
    server = await new Promise<Server>(resolve => {
        const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Interactive COEER fixture failed to listen')
    backend = `http://127.0.0.1:${address.port}`
}
async function closeApplication() {
    await stopWorker?.()
    stopWorker = undefined
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    server = undefined
    if (context) await context.db.close()
}
beforeEach(async () => {
    scope = createTestDatabase('submission')
    await scope.initialize()
    adapter = new InteractiveOfficialAdapter()
    await startApplication()
    await new Accounts(context.db).save('2026000001')
    adapter.listCalls = 0
    adapter.availabilityCalls = 0
    adapter.syncStarted = deferred()
})
afterEach(async () => {
    adapter?.createGate?.resolve()
    adapter?.getGate?.resolve()
    adapter?.syncGate?.resolve()
    await closeApplication()
    if (scope) await scope.close()
})
function call(path: string, init: RequestInit = {}) {
    return forwardSpaceRequest(new Request(origin + '/api/open-space' + path, init), student, backend, secret)
}
const input = () => ({ spaceId: 'synthetic-interactive-room', date: addDays(today(), 1), start: 495,
    end: 675, quantity: 1, purpose: '交互提交合成测试' })
async function submit(key: string, booking = input()) {
    const session = await (await call('/auth/me')).json()
    return call('/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin,
        'X-CSRF-Token': session.csrf, 'Idempotency-Key': key }, body: JSON.stringify(booking) })
}
function expectNoUpstreamCalls() {
    expect(adapter.listCalls).toBe(0)
    expect(adapter.availabilityCalls).toBe(0)
    expect(adapter.createCalls).toHaveLength(0)
    expect(adapter.getCalls).toHaveLength(0)
}
async function eventually(check: () => Promise<boolean>) {
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
        if (await check()) return
        await delay(10)
    }
    throw new Error('Synthetic durable execution did not settle')
}

function runWorker() { stopWorker = context.startWorker(15) }
async function detail(id: string): Promise<Booking> {
    const response = await call(`/bookings/${id}`)
    expect(response.status).toBe(200)
    return response.json()
}

describe('COEER asynchronous official submission', () => {
    it('returns a durable booking ID before slow official processing and exposes progress through detail reads', async () => {
        adapter.createGate = deferred()
        adapter.getGate = deferred()
        const response = await submit('async-before-official-verification')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        expect(booking.status).toBe('queued')
        expectNoUpstreamCalls()
        expect((await detail(booking.id)).status).toBe('queued')
        expect((await context.db.get<{ state: string }>("SELECT state FROM jobs WHERE booking_id=? AND type='create'", booking.id))?.state).toBe('pending')
        runWorker()
        await adapter.createStarted.promise
        expect((await detail(booking.id)).status).toBe('submitting')
        adapter.createGate.resolve()
        await adapter.getStarted.promise
        expect((await detail(booking.id)).status).toBe('accepted')
        adapter.getGate.resolve()
        await eventually(async () => (await detail(booking.id)).status === 'confirmed')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.getCalls).toHaveLength(1)
    })

    it('reuses the saved application on immediate retries and performs the official write only once', async () => {
        const responses = await Promise.all([submit('async-shared-idempotency'), submit('async-shared-idempotency')])
        expect(responses.map(response => response.status)).toEqual([202, 202])
        const bookings = await Promise.all(responses.map(response => response.json() as Promise<Booking>))
        expect(bookings[0].id).toBe(bookings[1].id)
        expect(bookings.every(booking => booking.status === 'queued')).toBe(true)
        expectNoUpstreamCalls()
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
        runWorker()
        await eventually(async () => (await detail(bookings[0].id)).status === 'confirmed')
        const retry = await submit('async-shared-idempotency')
        expect(retry.status).toBe(201)
        expect((await retry.json()).id).toBe(bookings[0].id)
        expect(adapter.createCalls).toHaveLength(1)
    })

    it('rejects a conflicting COEER booking locally before touching the official system', async () => {
        const user = (await new Accounts(context.db).communityUser(student))!
        await context.service.create(user.id, input(), 'async-existing-local-hold', {
            applicantName: user.name, studentId: user.studentId!,
        })
        const response = await submit('async-local-conflict')
        expect(response.status).toBe(409)
        expect((await response.json()).error.code).toBe('CONFLICT')
        expectNoUpstreamCalls()
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
    })

    it('can finish a booking while background synchronization is still waiting', async () => {
        adapter.syncGate = deferred()
        await context.service.enqueue('sync')
        let syncFinished = false
        const synchronization = context.service.runOne({ lane: 'sync' }).finally(() => { syncFinished = true })
        try {
            await adapter.syncStarted.promise
            const response = await submit('async-does-not-wait-for-sync')
            expect(response.status).toBe(202)
            const booking = await response.json() as Booking
            expect((await context.service.waitForResult(booking.id)).status).toBe('confirmed')
            expect(syncFinished).toBe(false)
        } finally {
            adapter.syncGate.resolve()
            await synchronization
        }
    })

    it('exposes an official preflight failure in the saved detail instead of losing the application', async () => {
        adapter.createFailure = 'CONFLICT'
        const response = await submit('async-official-conflict')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        runWorker()
        await eventually(async () => (await detail(booking.id)).status === 'failed')
        const retry = await submit('async-official-conflict')
        expect(retry.status).toBe(409)
        expect((await retry.json()).error).toMatchObject({ code: 'BOOKING_FAILED', bookingId: booking.id })
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.saveCalls).toBe(0)
    })

    it('updates the detail to pending approval without claiming the booking is confirmed', async () => {
        adapter.finalStatus = 'pending_approval'
        const response = await submit('async-official-approval')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        expect(booking.status).toBe('queued')
        runWorker()
        await eventually(async () => (await detail(booking.id)).status === 'pending_approval')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.getCalls).toHaveLength(1)
    })

    it('preserves uncertainty after a lost write response and never resubmits it', async () => {
        adapter.createFailure = 'TIMEOUT'
        const response = await submit('async-unknown-official-result')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        runWorker()
        await eventually(async () => ['uncertain', 'manual_review'].includes((await detail(booking.id)).status))
        const retry = await submit('async-unknown-official-result')
        expect(retry.status).toBe(202)
        expect((await retry.json()).id).toBe(booking.id)
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.saveCalls).toBe(1)
    })

    it('independently confirms a timed-out write with a persisted official reference', async () => {
        adapter.createFailure = 'TIMEOUT'
        adapter.returnReferenceOnFailure = true
        adapter.onInitialized = (command, ref) => context.db.run('UPDATE bookings SET official_ref=? WHERE id=?', ref, command.requestId).then(() => undefined)
        const response = await submit('async-timeout-known-reference')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        runWorker()
        await eventually(async () => (await detail(booking.id)).status === 'confirmed')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.getCalls).toHaveLength(1)
    })

    it('keeps processing after the creation response and waits for in-flight work during shutdown', async () => {
        adapter.createGate = deferred()
        const response = await submit('async-request-independent')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        const execution = context.service.runOne({ lane: 'booking', bookingId: booking.id })
        await adapter.createStarted.promise
        let drained = false
        const draining = context.service.drain().then(() => { drained = true })
        try {
            await delay(30)
            expect(drained).toBe(false)
            expect((await detail(booking.id)).status).toBe('submitting')
        } finally {
            adapter.createGate.resolve()
            await execution
            await draining
        }
        expect((await context.service.waitForResult(booking.id)).status).toBe('confirmed')
        expect(adapter.createCalls).toHaveLength(1)
    })

    it('recovers a saved queued application after restarting the server', async () => {
        const response = await submit('async-restart-queued-request')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        expectNoUpstreamCalls()
        await closeApplication()
        await startApplication({ deferInitialSync: true })
        expect((await detail(booking.id)).status).toBe('queued')
        runWorker()
        await eventually(async () => (await detail(booking.id)).status === 'confirmed')
        expect(adapter.createCalls).toHaveLength(1)
    })

    it('keeps review-required applications out of the official queue until approval', async () => {
        await new Accounts(context.db).save('2026000001', '', 'review')
        const response = await submit('async-awaits-administrator-review')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        expect(booking.status).toBe('pending_review')
        expect(await context.service.runOne({ lane: 'booking', bookingId: booking.id })).toBe(false)
        expect((await detail(booking.id)).status).toBe('pending_review')
        expectNoUpstreamCalls()
    })
})
