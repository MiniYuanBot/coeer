import {
  rootRouteId,
  useMatch,
  useRouter,
  Link,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '../coeer'

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  if (import.meta.env.DEV) {
    console.error(error)
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto max-w-md">
        <div className="mb-6 rounded-lg border border-border bg-card p-5 text-left">
          <h1 className="text-lg font-semibold text-foreground">暂时无法加载页面</h1>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            {error instanceof Error && /[\u3400-\u9fff]/.test(error.message) ? error.message : '请检查网络连接，或稍后重试。'}
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {isRoot ? (
              <Button asChild variant="outline" className="w-full sm:w-auto"><Link to="/">
                返回首页
              </Link></Button>
          ) : (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => window.history.back()}
            >
              返回上一页
            </Button>
          )}
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => router.invalidate()}
          >
            重试
          </Button>
        </div>
      </div>
    </div>
  )
}
