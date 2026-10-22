import { createFileRoute } from '@tanstack/react-router'
import { AuthService } from '~/services/AuthService'
import { forwardSpaceRequest } from '~/open-space/gateway'
import { getEmbeddedSpaceServer } from '~/open-space/embedded'

async function handle({ request }: { request: Request }) {
  const identity = await AuthService.getCurrentUser()
  if (!identity.success || !identity.data) {
    return Response.json({ error: { code: 'COEER_UNAUTHORIZED', message: '请先登录 COEER' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    // Reading this promise never starts or retries background synchronization.
    const backend = process.env.BOOKING_ENGINE_URL || (await getEmbeddedSpaceServer()).url
    return await forwardSpaceRequest(request, identity.data, backend)
  } catch {
    return Response.json({ error: { code: 'SPACE_UNAVAILABLE', message: '空间预约服务未就绪，请联系管理员检查配置' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const Route = createFileRoute('/api/open-space/$')({
  server: { handlers: { GET: handle, HEAD: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle, OPTIONS: handle } },
})
