import { expect, it } from 'vitest'
import { Agent, createServer, request } from 'node:http'
import type { Socket } from 'node:net'
import { OfficialHTTP } from '../../src/server/open-space/adapters/official/http'
import { parseOfficialConfig } from '../../src/server/open-space/adapters/official/config'

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
