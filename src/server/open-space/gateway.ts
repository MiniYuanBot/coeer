import { createHash } from 'node:crypto'

export const SPACE_API_PREFIX = '/api/open-space'
type Identity = { id: string; role: string }

function error(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function spaceCookieName(userId: string) {
  return `coeer_spaces_${createHash('sha256').update(userId).digest('hex').slice(0, 24)}`
}

/** Both the COEER session and booking engine enforce their own authorization. */
export async function forwardSpaceRequest(request: Request, user: Identity | null | undefined, backend: string) {
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
    throw new Error('OPENSPACE_BACKEND_URL must be an HTTP(S) origin')
  }
  target.pathname = '/api' + path
  target.search = url.search
  const headers = new Headers()
  headers.set('x-coeer-account', user.id)
  for (const name of ['content-type', 'x-csrf-token', 'idempotency-key']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  // Translate only this COEER user's booking cookie; never forward community credentials.
  const cookieName = spaceCookieName(user.id)
  const token = request.headers.get('cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
  if (token && /^[A-Za-z0-9_-]{1,100}$/.test(token)) headers.set('cookie', `openspace_session=${token}`)
  // Origin is checked above; identify the configured upstream to its own origin guard.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) headers.set('origin', process.env.OPENSPACE_APP_ORIGIN ?? (process.env.OPENSPACE_BACKEND_URL ? target.origin : process.env.CLIENT_URL ?? url.origin))
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
    response = await fetch(target, { method: request.method, headers, body, redirect: 'error', signal: AbortSignal.timeout(30000) })
  } catch {
    return error(503, 'SPACE_UNAVAILABLE', '空间预约服务暂不可用，请稍后重试')
  }
  const resultHeaders = new Headers({ 'Content-Type': response.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' })
  const retry = response.headers.get('retry-after')
  if (retry) resultHeaders.set('retry-after', retry)
  for (const cookie of response.headers.getSetCookie()) {
    if (!cookie.startsWith('openspace_session=')) continue
    const translated = cookie.replace('openspace_session=', cookieName + '=').replace(/;\s*Path=[^;]*/i, `; Path=${SPACE_API_PREFIX}`).replace(/;\s*Domain=[^;]*/ig, '')
    resultHeaders.append('set-cookie', translated)
  }
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers: resultHeaders })
}
