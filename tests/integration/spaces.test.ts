import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/open-space/app'
import { forwardSpaceRequest, spaceCookieName } from '../../src/server/open-space/gateway'
import { addDays, today } from '../../src/shared/open-space/domain'
import type { Server } from 'node:http'

const origin = 'http://localhost:3000'
const alice = { id: 'coeer-student-a', role: 'student' }
const bob = { id: 'coeer-student-b', role: 'student' }
const administrator = { id: 'coeer-admin', role: 'admin' }
let context: Awaited<ReturnType<typeof createApp>>
let server: Server
let backend: string

beforeEach(async () => {
    context = await createApp({ demo: true, origin, serveClient: false })
    server = await new Promise<Server>((resolve) => {
        const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
    })
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server not listening')
    backend = `http://127.0.0.1:${address.port}`
})
afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    context.db.close()
})
function call(path: string, identity: typeof alice | null = alice, init: RequestInit = {}) {
    return forwardSpaceRequest(new Request(`${origin}/api/open-space${path}`, init), identity, backend)
}
async function login(identity = alice, studentId = '0000000001', password = '0000000001@114514') {
    const response = await call('/auth/login', identity, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ studentId, password }),
    })
    expect(response.status).toBe(200)
    const cookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith(spaceCookieName(identity.id)))
        ?.split(';')[0]
    expect(cookie).toBeTruthy()
    const session = await response.json()
    return { cookie: cookie!, csrf: session.csrf as string }
}

async function processJobs() {
    for (let index = 0; index < 12; index++) {
        context.db.run("UPDATE jobs SET run_at=0 WHERE state='pending'")
        if (!(await context.service.runOne())) return
    }
    throw new Error('Booking jobs did not settle')
}

describe('COEER booking gateway', () => {
    it('rejects unauthenticated access to public and private upstream APIs', async () => {
        expect((await call('/spaces', null)).status).toBe(401)
        expect((await call('/bookings', null)).status).toBe(401)
    })
    it('provides the complete directory without forwarding community cookies', async () => {
        const response = await call('/spaces', alice, {
            headers: { Cookie: 'coeer_session=private; openspace_session=untrusted' },
        })
        expect(response.status).toBe(200)
        expect((await response.json()).length).toBe(3)
        expect(response.headers.get('cache-control')).toBe('no-store')
    })
    it('scopes booking sessions to one COEER user and the booking API', async () => {
        const { cookie } = await login()
        const response = await call('/auth/me', alice, { headers: { Cookie: cookie } })
        expect((await response.json()).user.studentId).toBe('0000000001')
        const other = await call('/auth/me', bob, { headers: { Cookie: cookie } })
        expect((await other.json()).user).toBeNull()
    })
    it('sets HttpOnly cookies scoped to the feature and clears the same cookie on logout', async () => {
        const result = await call('/auth/login', alice, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: '0000000001', password: '0000000001@114514' }),
        })
        const cookie = result.headers.getSetCookie()[0]
        expect(cookie).toContain('Path=/api/open-space;')
        expect(cookie).toContain('HttpOnly')
        const session = await result.json()
        const logout = await call('/auth/logout', alice, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: cookie.split(';')[0],
                'X-CSRF-Token': session.csrf,
            },
            body: '{}',
        })
        expect(logout.status).toBe(200)
        expect(logout.headers.getSetCookie()[0]).toContain(`${spaceCookieName(alice.id)}=;`)
    })
    it('blocks a booking administrator from bypassing the COEER role guard', async () => {
        const { cookie } = await login(alice, '9999999999', 'demo-admin-2026')
        expect((await call('/admin/overview', alice, { headers: { Cookie: cookie } })).status).toBe(403)
    })
    it('requires booking administrator credentials as well as the community role', async () => {
        expect((await call('/admin/overview', administrator)).status).toBe(401)
        const { cookie } = await login(administrator, '9999999999', 'demo-admin-2026')
        expect((await call('/admin/overview', administrator, { headers: { Cookie: cookie } })).status).toBe(
            200,
        )
    })
    it('rejects cross-origin mutations and oversized bodies', async () => {
        expect(
            (
                await call('/auth/login', alice, {
                    method: 'POST',
                    headers: { Origin: 'https://elsewhere.invalid' },
                    body: '{}',
                })
            ).status,
        ).toBe(403)
        expect((await call('/auth/login', alice, { method: 'POST', body: 'x'.repeat(16385) })).status).toBe(
            413,
        )
    })
    it('completes creation and cancellation while retaining CSRF, idempotency and ownership', async () => {
        const { cookie, csrf } = await login()
        const input = JSON.stringify({
            spaceId: 'mock-meeting-harbor',
            date: addDays(today(), 1),
            start: 600,
            end: 660,
            quantity: 1,
            purpose: '集成测试研讨',
        })
        const headers = {
            Cookie: cookie,
            'Content-Type': 'application/json',
            'Idempotency-Key': 'coeer-gateway-booking-0001',
        }
        expect((await call('/bookings', alice, { method: 'POST', headers, body: input })).status).toBe(403)
        const first = await call('/bookings', alice, {
            method: 'POST',
            headers: { ...headers, 'X-CSRF-Token': csrf },
            body: input,
        })
        expect(first.status).toBe(201)
        const booking = await first.json()
        const repeated = await call('/bookings', alice, {
            method: 'POST',
            headers: { ...headers, 'X-CSRF-Token': csrf },
            body: input,
        })
        expect((await repeated.json()).id).toBe(booking.id)
        expect((await call(`/bookings/${booking.id}`, bob, { headers: { Cookie: cookie } })).status).toBe(401)
        await processJobs()
        const confirmed = await call(`/bookings/${booking.id}`, alice, { headers: { Cookie: cookie } })
        expect((await confirmed.json()).status).toBe('confirmed')
        const cancellation = await call(`/bookings/${booking.id}/cancel`, alice, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
            body: '{}',
        })
        expect(cancellation.status).toBe(200)
        await processJobs()
        const cancelled = await call(`/bookings/${booking.id}`, alice, { headers: { Cookie: cookie } })
        expect((await cancelled.json()).status).toBe('cancelled')
    })
    it('returns a useful service error when the upstream cannot be reached', async () => {
        const response = await forwardSpaceRequest(
            new Request(`${origin}/api/open-space/config`),
            alice,
            'http://127.0.0.1:1',
        )
        expect(response.status).toBe(503)
        expect((await response.json()).error.code).toBe('SPACE_UNAVAILABLE')
    })
})
