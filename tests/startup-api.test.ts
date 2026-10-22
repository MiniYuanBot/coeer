import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
    get: vi.fn(async () => { throw new Error('Space background runtime has not started') }),
    start: vi.fn(),
    auth: vi.fn(async () => ({ success: true, data: { id: 'test', email: '2026000001@stu.pku.edu.cn', name: '测试', role: 'student' } })),
    forward: vi.fn(async () => Response.json({ ok: true })),
}))
vi.mock('~/services/AuthService', () => ({ AuthService: { getCurrentUser: runtime.auth } }))
vi.mock('~/open-space/embedded', () => ({ getEmbeddedSpaceServer: runtime.get, startEmbeddedSpaceServer: runtime.start }))
vi.mock('~/open-space/gateway', () => ({ forwardSpaceRequest: runtime.forward }))

import { Route } from '../src/app/routes/api/open-space/$'

const get = (Route.options.server!.handlers as unknown as { GET: (context: { request: Request }) => Promise<Response> }).GET
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('BOOKING_ENGINE_URL', '') })
afterEach(() => vi.unstubAllEnvs())

it('returns 503 for a runtime that has not started without starting or retrying it', async () => {
    for (let index = 0; index < 3; index++) {
        const response = await get({ request: new Request('http://localhost/api/open-space/config') })
        expect(response.status).toBe(503)
        expect((await response.json()).error.code).toBe('SPACE_UNAVAILABLE')
    }
    expect(runtime.get).toHaveBeenCalledTimes(3)
    expect(runtime.start).not.toHaveBeenCalled()
    expect(runtime.forward).not.toHaveBeenCalled()
})

it('uses an explicitly configured external runtime without initializing an embedded engine', async () => {
    vi.stubEnv('BOOKING_ENGINE_URL', 'https://engine.invalid')
    expect((await get({ request: new Request('http://localhost/api/open-space/config') })).status).toBe(200)
    expect(runtime.get).not.toHaveBeenCalled()
    expect(runtime.start).not.toHaveBeenCalled()
    expect(runtime.forward).toHaveBeenCalledOnce()
})
