import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/open-space/app'
import { Accounts } from '../../src/server/open-space/accounts'
import { forwardSpaceRequest } from '../../src/server/open-space/gateway'
import { signCommunityIdentity } from '../../src/server/open-space/coeer-identity'
import { addDays, today } from '../../src/shared/open-space/domain'
import { createTestDatabase, databaseUrl } from '../support/postgres'
import type { Server } from 'node:http'

const origin = 'http://localhost:3000'
const secret = 'coeer-test-private-booking-identity-key'
const alice = { id: 'coeer-student-a', role: 'student', email: '0000000001@stu.pku.edu.cn', name: '学生甲' }
const bob = { id: 'coeer-student-b', role: 'student', email: '0000000002@stu.pku.edu.cn', name: '学生乙' }
const administrator = { id: 'coeer-admin', role: 'admin', email: 'admin@example.com', name: '社区管理员' }
let context: Awaited<ReturnType<typeof createApp>>
let scope: ReturnType<typeof createTestDatabase>
let server: Server
let backend: string

beforeEach(async () => {
    scope = createTestDatabase('spaces')
    await scope.initialize()
    context = await createApp({ databaseUrl, databaseSchema: scope.name, demo: true, origin, serveClient: false, communityIdentitySecret: secret })
    await new Accounts(context.db).save('0000000002')
    server = await new Promise<Server>((resolve) => {
        const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server not listening')
    backend = `http://127.0.0.1:${address.port}`
})
afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    if (context) await context.db.close()
    if (scope) await scope.close()
})
function call(path: string, identity: typeof alice | null = alice, init: RequestInit = {}) {
    return forwardSpaceRequest(new Request(`${origin}/api/open-space${path}`, init), identity, backend, secret)
}
async function session(identity = alice) {
    const response = await call('/auth/me', identity)
    expect(response.status).toBe(200)
    return response.json() as Promise<{ csrf: string; user: { id: string; name: string; role: string; studentId?: string; bookingPermission: string } }>
}
async function mutate(path: string, input: unknown, identity = administrator, method = 'PUT') {
    const { csrf } = await session(identity)
    return call(path, identity, { method, headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(input) })
}
async function processJobs() {
    for (let index = 0; index < 12; index++) {
        await context.db.run("UPDATE jobs SET run_at=0 WHERE state='pending'")
        if (!(await context.service.runOne())) return
    }
    throw new Error('Booking jobs did not settle')
}
const bookingInput = () => ({
    spaceId: 'mock-meeting-harbor', date: addDays(today(), 1), start: 600, end: 660, quantity: 1, purpose: '集成测试研讨',
})

describe('COEER booking integration', () => {
    it('requires community authentication for all booking APIs', async () => {
        expect((await call('/spaces', null)).status).toBe(401)
        expect((await call('/bookings', null)).status).toBe(401)
    })
    it('derives the student identity from the current community account without another login', async () => {
        const result = await session()
        expect(result.user).toMatchObject({ studentId: '0000000001', name: alice.name, role: 'user', bookingPermission: 'allowed' })
        expect(result.csrf).toBeTruthy()
        const response = await call('/spaces', alice, { headers: { Cookie: 'coeer_session=private; openspace_session=untrusted' } })
        expect(response.status).toBe(200)
        expect((await response.json()).length).toBe(3)
        expect(response.headers.getSetCookie()).toEqual([])
    })
    it('does not trust caller-supplied identity headers or unsigned direct backend requests', async () => {
        const spoofed = await call('/auth/me', alice, { headers: { 'X-Coeer-Account': administrator.id, 'X-Coeer-Identity': signCommunityIdentity(administrator, secret) } })
        expect((await spoofed.json()).user.role).toBe('user')
        const unsigned = await fetch(`${backend}/api/auth/me`, { headers: { 'X-Coeer-Account': administrator.id } })
        expect(unsigned.status).toBe(401)
        const invalid = await fetch(`${backend}/api/auth/me`, { headers: { 'X-Coeer-Identity': signCommunityIdentity(administrator, 'wrong-secret') } })
        expect(invalid.status).toBe(401)
    })
    it('grants community administrators booking administration without student credentials', async () => {
        expect((await call('/admin/overview', alice)).status).toBe(403)
        expect((await call('/admin/overview', administrator)).status).toBe(200)
        expect((await session(administrator)).user).toMatchObject({ role: 'admin', name: administrator.name })
        expect((await call('/admin/overview', { ...administrator, role: 'student' })).status).toBe(403)
    })
    it('retires separate booking login, password and logout endpoints', async () => {
        for (const path of ['/auth/login', '/auth/password', '/auth/logout']) {
            expect((await call(path, alice, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(410)
        }
    })
    it('accepts student-only allowlists and displays the current community nickname', async () => {
        const save = await mutate('/admin/allowlist/0000000003', { bookingPermission: 'review' })
        expect(save.status).toBe(200)
        const third = { id: 'coeer-student-c', role: 'student', email: '0000000003@stu.pku.edu.cn', name: '昵称丙' }
        expect((await session(third)).user.bookingPermission).toBe('review')
        await session({ ...third, name: '已修改的昵称' })
        const response = await call('/admin/overview', administrator)
        const body = await response.json()
        expect(body.allowlist.find((row: { studentId: string }) => row.studentId === '0000000003')).toMatchObject({ name: '已修改的昵称', bookingPermission: 'review' })
    })
    it('blocks unlisted students and revokes permission immediately when removed', async () => {
        expect((await session({ ...alice, id: 'unlisted', email: '0000000004@stu.pku.edu.cn' })).user.bookingPermission).toBe('blocked')
        expect((await mutate('/admin/allowlist/0000000001', {}, administrator, 'DELETE')).status).toBe(200)
        expect((await session()).user.bookingPermission).toBe('blocked')
        const { csrf } = await session()
        const denied = await call('/bookings', alice, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': 'coeer-revoked-booking-001' }, body: JSON.stringify(bookingInput()) })
        expect(denied.status).toBe(403)
    })
    it('does not derive student privileges from a nonstudent email or browser applicant fields', async () => {
        const response = await call('/auth/me', { ...alice, email: 'student@example.com' })
        expect((await response.json()).user).toBeNull()
        const { csrf } = await session()
        const forged = await call('/bookings', alice, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': 'coeer-forged-applicant-01' }, body: JSON.stringify({ ...bookingInput(), studentId: '0000000002' }) })
        expect(forged.status).toBe(403)
    })
    it('rejects cross-origin mutations, oversized bodies and another users CSRF token', async () => {
        expect((await call('/bookings', alice, { method: 'POST', headers: { Origin: 'https://elsewhere.invalid' }, body: '{}' })).status).toBe(403)
        expect((await call('/bookings', alice, { method: 'POST', body: 'x'.repeat(16385) })).status).toBe(413)
        const { csrf } = await session(bob)
        const response = await call('/bookings', alice, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, 'Idempotency-Key': 'coeer-cross-user-csrf-001' }, body: JSON.stringify(bookingInput()) })
        expect(response.status).toBe(403)
    })
    it('creates, confirms and cancels bookings with CSRF, idempotency and owner isolation', async () => {
        const { csrf } = await session()
        const input = JSON.stringify(bookingInput())
        const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': 'coeer-gateway-booking-0001' }
        expect((await call('/bookings', alice, { method: 'POST', headers, body: input })).status).toBe(403)
        const first = await call('/bookings', alice, { method: 'POST', headers: { ...headers, 'X-CSRF-Token': csrf }, body: input })
        expect(first.status).toBe(201)
        const booking = await first.json()
        const repeated = await call('/bookings', alice, { method: 'POST', headers: { ...headers, 'X-CSRF-Token': csrf }, body: input })
        expect((await repeated.json()).id).toBe(booking.id)
        expect((await call(`/bookings/${booking.id}`, bob)).status).toBe(404)
        await processJobs()
        expect((await (await call(`/bookings/${booking.id}`)).json()).status).toBe('confirmed')
        const cancellation = await call(`/bookings/${booking.id}/cancel`, alice, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: '{}' })
        expect(cancellation.status).toBe(200)
        await processJobs()
        expect((await (await call(`/bookings/${booking.id}`)).json()).status).toBe('cancelled')
    })
    it('retains every API rate-limit increment during concurrent PostgreSQL requests', async () => {
        const responses = await Promise.all(Array.from({ length: 8 }, () => call('/spaces')))
        expect(responses.map(response => response.status)).toEqual(Array(8).fill(200))
        expect((await context.db.get<{ count: number }>('SELECT count FROM rate_limits'))?.count).toBe(8)
    })
    it('serializes concurrent PostgreSQL reservations without double-booking a room', async () => {
        const [aliceSession, bobSession] = await Promise.all([session(alice), session(bob)])
        const responses = await Promise.all([alice, bob].map((identity, index) => call('/bookings', identity, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': index ? bobSession.csrf : aliceSession.csrf,
                'Idempotency-Key': `coeer-concurrent-booking-${index}`,
            },
            body: JSON.stringify(bookingInput()),
        })))
        expect(responses.map(response => response.status).sort()).toEqual([201, 409])
        expect((await context.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM bookings'))?.count).toBe(1)
    })
    it('returns a useful service error when the upstream cannot be reached', async () => {
        const response = await forwardSpaceRequest(new Request(`${origin}/api/open-space/config`), alice, 'http://127.0.0.1:1', secret)
        expect(response.status).toBe(503)
        expect((await response.json()).error.code).toBe('SPACE_UNAVAILABLE')
    })
})
