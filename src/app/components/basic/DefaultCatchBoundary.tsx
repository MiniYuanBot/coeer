import {
  ErrorComponent,
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
        <div className="mb-6 rounded-xl border border-border bg-card p-5 text-left">
          <div className="text-sm font-medium text-foreground">页面出错了</div>
          <div className="mt-2 text-sm leading-6 text-muted-foreground">
            <ErrorComponent error={error} />
          </div>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {isRoot ? (
            <Link to="/">
              <Button variant="outline" className="w-full sm:w-auto">
                返回首页
              </Button>
            </Link>
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
