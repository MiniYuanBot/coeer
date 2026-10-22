import { afterEach, expect, it, vi } from 'vitest'
import { Agent, createServer, request } from 'node:http'
import type { Socket } from 'node:net'
import { OfficialHTTP, type Operation } from '../../src/server/open-space/adapters/official/http'
import { parseOfficialConfig } from '../../src/server/open-space/adapters/official/config'

afterEach(() => vi.restoreAllMocks())

function configuration(requestTimeoutMs = 2000) {
    return parseOfficialConfig({ baseURL: 'https://synthetic-official.invalid/meeting/',
        account: { alias: 'synthetic-http' }, minIntervalMs: 0, requestTimeoutMs })
}

it('reads profile and room listings once each from a legacy server that rejects connection reuse', async () => {
    const calls: string[] = []
    const sockets = new Set<Socket>()
    const requestsPerSocket = new WeakMap<Socket, number>()
    const server = createServer((incoming, response) => {
        const count = (requestsPerSocket.get(incoming.socket) ?? 0) + 1
        requestsPerSocket.set(incoming.socket, count)
        sockets.add(incoming.socket)
        calls.push(incoming.url!)
        incoming.resume()
        incoming.once('end', () => {
            response.setHeader('Content-Type', 'application/json')
            // Reproduce the old campus HTTP/1.1 server's broken keep-alive behavior.
            response.statusCode = count === 1 ? 200 : 503
            response.end(JSON.stringify({ ok: count === 1 }))
        })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Local HTTP fixture failed to listen')
    // One socket slot makes reuse deterministic. The production transport still supplies
    // every request option; this adapter only bridges native HTTP to fetch's Response.
    const agent = new Agent({ keepAlive: true, maxSockets: 1 })
    const fetcher: typeof fetch = (input, init) => new Promise((resolve, reject) => {
        const target = input instanceof Request ? input.url : input
        const outgoing = request(new URL(target), {
            agent,
            method: init?.method,
            headers: Object.fromEntries(new Headers(init?.headers)),
            signal: init?.signal ?? undefined,
        }, incoming => {
            const chunks: Buffer[] = []
            incoming.on('data', chunk => chunks.push(Buffer.from(chunk)))
            incoming.once('error', reject)
            incoming.once('end', () => resolve(new Response(Buffer.concat(chunks).toString(), {
                status: incoming.statusCode,
                headers: { 'Content-Type': String(incoming.headers['content-type']) },
            })))
        })
        outgoing.once('error', reject)
        outgoing.end(init?.body?.toString())
    })
    try {
        const config = parseOfficialConfig({
            baseURL: `http://127.0.0.1:${address.port}/meeting/`, allowHTTP: true,
            account: { alias: 'local-http-fixture' }, minIntervalMs: 0, requestTimeoutMs: 2000,
        })
        const session = await new OfficialHTTP(config, async () => ({}), fetcher).session()
        expect((await session.request('profile', {}, {})).status).toBe(200)
        expect((await session.request('meetingList', {}, {})).status).toBe(200)
        expect(calls).toEqual(['/meeting/head/getList.do', '/meeting/meeting/reList.do'])
        expect(sockets.size).toBe(2)
    } finally {
        agent.destroy()
        server.closeAllConnections()
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
})

it('recovers the first profile connection and continues reading in the same startup session', async () => {
    const calls: string[] = []
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const server = createServer((incoming, response) => {
        calls.push(incoming.url!.split('?')[0])
        incoming.resume()
        incoming.once('end', () => {
            if (calls.length === 1) incoming.socket.destroy()
            else response.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
        })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Local HTTP fixture failed to listen')
    try {
        const config = parseOfficialConfig({ ...configuration(),
            baseURL: `http://127.0.0.1:${address.port}/meeting/`, allowHTTP: true })
        const session = await new OfficialHTTP(config, async () => ({})).session()
        expect((await session.request('profile', {}, {})).status).toBe(200)
        expect((await session.request('meetingList', {}, {})).status).toBe(200)
        expect(calls).toEqual(['/meeting/head/getList.do', '/meeting/head/getList.do', '/meeting/meeting/reList.do'])
        expect(log.mock.calls.map(([entry]) => JSON.parse(entry).event)).toContain('spaces.official.request_retry')
    } finally {
        server.closeAllConnections()
        await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
})

it('retries a read with a fresh request deadline after the first request times out', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = vi.fn<typeof fetch>()
        .mockImplementationOnce((_input, init) => new Promise((_resolve, reject) => {
            init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
        }))
        .mockResolvedValueOnce(new Response('{}'))
    const session = await new OfficialHTTP(configuration(100), async () => ({}), fetcher).session()
    expect((await session.request('meetingSlots', {}, {})).status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true)
    expect(fetcher.mock.calls[1][1]!.signal!.aborted).toBe(false)
})

it('stops after bounded read retries and records sanitized request diagnostics', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('private body and cookie', {
        cause: Object.assign(new Error('private official address'), { code: 'ECONNRESET' }),
    }))
    const invalidate = vi.fn()
    const transport = new OfficialHTTP(configuration(), Object.assign(async () => ({ Cookie: 'private-cookie' }), { invalidate }), fetcher)
    const session = await transport.session()
    await expect(session.request('activityList', { secret: 'private-query' }, { secret: 'private-form' })).rejects.toMatchObject({ code: 'NETWORK' })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(invalidate).toHaveBeenCalledExactlyOnceWith('NETWORK')
    expect(transport.diagnostics()).toMatchObject({ lastRequestFailure: {
        operation: 'activityList', phase: 'request', attempt: 3, code: 'NETWORK', transportCode: 'ECONNRESET',
    } })
    expect(JSON.stringify(log.mock.calls)).not.toContain('private')
})

it.each<Operation>(['initialize', 'verify', 'create', 'cancel'])('does not replay %s after a connection failure', async operation => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('unknown outcome'))
    const session = await new OfficialHTTP(configuration(), async () => ({}), fetcher).session()
    await expect(session.request(operation, {}, {})).rejects.toMatchObject({ code: 'NETWORK' })
    expect(fetcher).toHaveBeenCalledOnce()
})

it.each([401, 403, 429, 503, 500])('does not retry an HTTP %i response', async status => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status }))
    const session = await new OfficialHTTP(configuration(), async () => ({}), fetcher).session()
    await expect(session.request('profile', {}, {})).rejects.toBeDefined()
    expect(fetcher).toHaveBeenCalledOnce()
})

it('stops immediately when the caller cancels during read backoff', async () => {
    const controller = new AbortController()
    vi.spyOn(console, 'warn').mockImplementation(entry => {
        if (JSON.parse(entry).event === 'spaces.official.request_retry') controller.abort()
    })
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('cold connection failed'))
    const session = await new OfficialHTTP(configuration(), async () => ({}), fetcher).session()
    await expect(session.request('profile', {}, {}, { signal: controller.signal })).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(fetcher).toHaveBeenCalledOnce()
})
