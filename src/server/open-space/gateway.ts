import { communityIdentitySecret, signCommunityIdentity, type CommunityIdentity } from './coeer-identity'

export const SPACE_API_PREFIX = '/api/open-space'
type Identity = Omit<CommunityIdentity, 'name'> & { name: string | null }

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** The gateway alone signs the current account; browser identity headers are discarded. */
export async function forwardSpaceRequest(request: Request, user: Identity | null | undefined, backend: string, secret = communityIdentitySecret()) {
  if (!user) return error(401, 'COEER_UNAUTHORIZED', '请先登录 COEER')
  const url = new URL(request.url)
  if (!url.pathname.startsWith(SPACE_API_PREFIX + '/')) return error(404, 'NOT_FOUND', '接口不存在')
  const path = url.pathname.slice(SPACE_API_PREFIX.length)
  if ((path === '/admin' || path.startsWith('/admin/')) && user.role !== 'admin') {
    return error(403, 'FORBIDDEN', '需要 COEER 管理员权限')
  }
  const origin = request.headers.get('origin')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origin && origin !== url.origin) {
    return error(403, 'ORIGIN', '请求来源无效')
  }
  const target = new URL(backend)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash || target.pathname !== '/') {
    throw new Error('BOOKING_ENGINE_URL must be an HTTP(S) origin')
  }
  target.pathname = '/api' + path
  target.search = url.search
  const headers = new Headers()
  headers.set('x-coeer-account', user.id)
  headers.set('x-coeer-identity', signCommunityIdentity({ ...user, name: user.name?.trim() || user.email.split('@')[0] }, secret))
  for (const name of ['content-type', 'x-csrf-token', 'idempotency-key']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Origin is checked above; identify the configured upstream to its own origin guard.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) headers.set('origin', process.env.BOOKING_ALLOWED_ORIGIN ?? (process.env.BOOKING_ENGINE_URL ? target.origin : process.env.CLIENT_URL ?? url.origin))
  let body: ArrayBuffer | undefined
  if (!['GET', 'HEAD'].includes(request.method) && request.body) {
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let length = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      length += chunk.value.length
      if (length > 16384) {
        await reader.cancel()
        return error(413, 'PAYLOAD_SIZE', '请求内容过大')
      }
      chunks.push(chunk.value)
    }
    body = Uint8Array.from(Buffer.concat(chunks)).buffer
  }
  let response: Response
  try {
    // Creation returns the saved application immediately; only approval waits
    // for official verification. Detail reads use PostgreSQL without replaying writes.
    const approval = request.method === 'POST' && /^\/admin\/bookings\/[^/]+\/review$/.test(path)
    const timeout = approval ? 650000 : 30000
    response = await fetch(target, { method: request.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(timeout) })
  } catch {
    return error(503, 'SPACE_UNAVAILABLE', '空间预约服务暂不可用，请稍后重试')
  }
  const resultHeaders = new Headers({ 'Content-Type': response.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' })
  const retry = response.headers.get('retry-after')
  if (retry) resultHeaders.set('retry-after', retry)
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: resultHeaders })
}
