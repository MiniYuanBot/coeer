import { ConcurrencyGate, OverloadedError } from './concurrency'

/** Limit active handler work; response streaming is managed by the HTTP server. */
export function withRequestLimit<Args extends unknown[]>(handler: (...args: Args) => Response | Promise<Response>, limit: number) {
    const gate = new ConcurrencyGate(limit, 0, 1000)
    return async (...args: Args): Promise<Response> => {
        try { return await gate.run(() => handler(...args)) } catch (error) {
            if (!(error instanceof OverloadedError)) throw error
            return Response.json({ error: { code: error.code, message: error.message } }, {
                status: 503, headers: { 'Retry-After': '1', 'Cache-Control': 'no-store' },
            })
        }
    }
}
