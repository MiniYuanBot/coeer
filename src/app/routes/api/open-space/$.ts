import { createFileRoute } from '@tanstack/react-router'
import { AuthService } from '~/services/AuthService'
import { forwardSpaceRequest } from '~/open-space/gateway'

async function handle({ request }: { request: Request }) {
  const identity = await AuthService.getCurrentUser()
  if (!identity.success || !identity.data) {
    return Response.json({ error: { code: 'COEER_UNAUTHORIZED', message: '请先登录 COEER' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const backend = process.env.OPENSPACE_BACKEND_URL ?? (await (await import('~/open-space/embedded')).getEmbeddedSpaceServer()).url
    return await forwardSpaceRequest(request, identity.data, backend)
  } catch {
    return Response.json({ error: { code: 'SPACE_UNAVAILABLE', message: '空间预约服务未就绪，请联系管理员检查配置' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const Route = createFileRoute('/api/open-space/$')({
  server: { handlers: { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle, OPTIONS: handle } },
})
