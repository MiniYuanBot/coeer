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

describe('COEER interactive official submission', () => {
    it('waits for independent official verification before returning a confirmed booking', async () => {
        adapter.createGate = deferred()
        adapter.getGate = deferred()
        let returned = false
        const pending = submit('interactive-waits-for-verification').then(response => { returned = true; return response })
        try {
            await adapter.createStarted.promise
            expect(returned).toBe(false)
            adapter.createGate.resolve()
            await adapter.getStarted.promise
            expect(returned).toBe(false)
            adapter.getGate.resolve()
            const response = await pending
            expect(response.status).toBe(201)
            expect((await response.json()).status).toBe('confirmed')
            expect(adapter.createCalls).toHaveLength(1)
            expect(adapter.getCalls).toHaveLength(1)
        } finally {
            adapter.createGate.resolve()
            adapter.getGate.resolve()
            await pending
        }
    })

    it('shares an in-flight idempotency key and submits to the official system only once', async () => {
        adapter.createGate = deferred()
        const first = submit('interactive-shared-idempotency')
        let second: Promise<Response> | undefined
        try {
            await adapter.createStarted.promise
            second = submit('interactive-shared-idempotency')
            adapter.createGate.resolve()
            const responses = await Promise.all([first, second])
            expect(responses.map(response => response.status)).toEqual([201, 201])
            const bookings = await Promise.all(responses.map(response => response.json() as Promise<Booking>))
            expect(bookings[0].id).toBe(bookings[1].id)
            expect(bookings.every(booking => booking.status === 'confirmed')).toBe(true)
            expect(adapter.createCalls).toHaveLength(1)
            expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
        } finally {
            adapter.createGate.resolve()
            await Promise.allSettled([first, ...(second ? [second] : [])])
        }
    })

    it('rejects a conflicting COEER booking locally before touching the official system', async () => {
        const user = (await new Accounts(context.db).communityUser(student))!
        await context.service.create(user.id, input(), 'interactive-existing-local-hold', {
            applicantName: user.name, studentId: user.studentId!,
        })
        const response = await submit('interactive-local-conflict')
        expect(response.status).toBe(409)
        expect((await response.json()).error.code).toBe('CONFLICT')
        expectNoUpstreamCalls()
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
    })

    it('can finish a booking while a durable background synchronization is still waiting', async () => {
        adapter.syncGate = deferred()
        await context.service.enqueue('sync')
        let syncFinished = false
        const synchronization = context.service.runOne({ lane: 'sync' }).finally(() => { syncFinished = true })
        try {
            await adapter.syncStarted.promise
            const response = await submit('interactive-does-not-wait-for-sync')
            expect(response.status).toBe(201)
            expect((await response.json()).status).toBe('confirmed')
            expect(syncFinished).toBe(false)
        } finally {
            adapter.syncGate.resolve()
            await synchronization
        }
    })

    it('returns an explicit failure and booking ID when the official preflight rejects the request', async () => {
        adapter.createFailure = 'CONFLICT'
        const response = await submit('interactive-official-conflict')
        expect(response.status).toBe(409)
        const result = await response.json()
        expect(result.error.code).toBe('BOOKING_FAILED')
        expect(result.error.bookingId).toEqual(expect.any(String))
        expect((await context.service.booking(result.error.bookingId)).status).toBe('failed')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.saveCalls).toBe(0)
    })

    it('returns pending approval as a verified result without claiming it is confirmed', async () => {
        adapter.finalStatus = 'pending_approval'
        const response = await submit('interactive-official-approval')
        expect(response.status).toBe(202)
        expect((await response.json()).status).toBe('pending_approval')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.getCalls).toHaveLength(1)
    })

    it('preserves uncertainty after a lost official write response and never resubmits it', async () => {
        adapter.createFailure = 'TIMEOUT'
        const response = await submit('interactive-unknown-official-result')
        expect(response.status).toBe(202)
        const booking = await response.json() as Booking
        expect(['uncertain', 'manual_review']).toContain(booking.status)
        expect(booking.status).not.toBe('failed')
        const repeat = await submit('interactive-unknown-official-result')
        expect(repeat.status).toBe(202)
        expect((await repeat.json()).id).toBe(booking.id)
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.saveCalls).toBe(1)
    })

    it('independently confirms a timed-out write when initialization already persisted its reference', async () => {
        adapter.createFailure = 'TIMEOUT'
        adapter.returnReferenceOnFailure = true
        adapter.onInitialized = (command, ref) => context.db.run('UPDATE bookings SET official_ref=? WHERE id=?', ref, command.requestId).then(() => undefined)
        const response = await submit('interactive-timeout-known-reference')
        expect(response.status).toBe(201)
        expect((await response.json()).status).toBe('confirmed')
        expect(adapter.createCalls).toHaveLength(1)
        expect(adapter.getCalls).toHaveLength(1)
    })

    it('returns at the HTTP waiting deadline without calling an in-flight official operation a failure', async () => {
        await closeApplication()
        await startApplication({ bookingWaitMs: 120, deferInitialSync: true })
        adapter.createGate = deferred()
        const pending = submit('interactive-http-deadline')
        let bookingId: string | undefined
        let draining: Promise<void> | undefined
        try {
            await adapter.createStarted.promise
            const response = await Promise.race([pending, delay(2000).then(() => { throw new Error('HTTP waiting deadline did not return') })])
            expect(response.status).toBe(202)
            const booking = await response.json() as Booking
            bookingId = booking.id
            expect(['queued', 'submitting', 'accepted', 'uncertain']).toContain(booking.status)
            expect(booking.status).not.toBe('failed')
            expect(adapter.createCalls).toHaveLength(1)
            let drained = false
            draining = context.service.drain().then(() => { drained = true })
            await delay(30)
            expect(drained).toBe(false)
        } finally {
            adapter.createGate.resolve()
            await pending
            await draining
            if (bookingId) {
                await eventually(async () => (await context.db.get<{ state: string }>("SELECT state FROM jobs WHERE booking_id=? AND type='create'", bookingId!))?.state === 'done')
                await context.db.run("UPDATE jobs SET run_at=0 WHERE booking_id=? AND state='pending'", bookingId)
                await context.service.waitForResult(bookingId)
            }
        }
        expect(adapter.createCalls).toHaveLength(1)
    })
})
