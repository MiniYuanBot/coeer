import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConcurrencyGate, OverloadedError } from '../src/server/utils/concurrency'
import { withRequestLimit } from '../src/server/utils/request-limit'

const deferred = () => {
    let resolve!: () => void
    const promise = new Promise<void>((done) => { resolve = done })
    return { promise, resolve }
}
afterEach(() => vi.useRealTimers())

describe('bounded concurrency', () => {
    it('rejects excess work and drains admitted work in order without exceeding the limit', async () => {
        const gate = new ConcurrencyGate(2, 8, 1000)
        const blocked = deferred()
        let active = 0, peak = 0
        const started: number[] = []
        const results = Array.from({ length: 100 }, (_, i) => gate.run(async () => {
            started.push(i)
            peak = Math.max(peak, ++active)
            await blocked.promise
            active--
        }))
        const settled = Promise.allSettled(results)
        await Promise.resolve()
        expect(started).toEqual([0, 1])
        blocked.resolve()
        const outcomes = await settled
        expect(peak).toBe(2)
        expect(started).toEqual(Array.from({ length: 10 }, (_, i) => i))
        expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(90)
        await expect(gate.run(() => 42)).resolves.toBe(42)
    })

    it('removes expired work instead of executing it later and releases failed work', async () => {
        vi.useFakeTimers()
        const gate = new ConcurrencyGate(1, 1, 50)
        const blocked = deferred()
        const first = gate.run(() => blocked.promise)
        const work = vi.fn()
        const expired = expect(gate.run(work)).rejects.toBeInstanceOf(OverloadedError)
        await vi.advanceTimersByTimeAsync(50)
        await expired
        blocked.resolve()
        await first
        await expect(gate.run(() => { throw new Error('failed') })).rejects.toThrow('failed')
        await expect(gate.run(() => 'recovered')).resolves.toBe('recovered')
        expect(work).not.toHaveBeenCalled()
    })

    it('returns retryable uncached HTTP 503 under load and preserves handler arguments and errors', async () => {
        const blocked = deferred()
        const handler = withRequestLimit(async (request: Request, context: { value: string }) => {
            await blocked.promise
            if (request.method === 'POST') throw new Error('handler failed')
            return new Response(context.value)
        }, 2)
        const request = new Request('https://example.test/')
        const responses = Array.from({ length: 100 }, () => handler(request, { value: 'ok' }))
        const rejected = await responses[2]
        expect(rejected.status).toBe(503)
        expect(rejected.headers.get('Retry-After')).toBe('1')
        expect(rejected.headers.get('Cache-Control')).toBe('no-store')
        blocked.resolve()
        const all = await Promise.all(responses)
        expect(all.filter((r) => r.status === 200)).toHaveLength(2)
        expect(await all[0].text()).toBe('ok')
        await expect(handler(new Request(request, { method: 'POST' }), { value: '' })).rejects.toThrow('handler failed')
        expect((await handler(request, { value: 'ok' })).status).toBe(200)
    })
})
