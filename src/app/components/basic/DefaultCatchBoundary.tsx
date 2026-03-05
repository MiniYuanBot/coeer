import {
  ErrorComponent,
  rootRouteId,
  useMatch,
  useRouter,
} from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { ButtonLink, Button } from '../ui/Button'  // 与 NotFound 保持一致

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter()
  const isRoot = useMatch({
    strict: false,
    select: (state) => state.id === rootRouteId,
  })

  console.error(error)

  return (
    <div className="min-w-30 flex flex-col items-center justify-center text-center p-8">
      <div className="max-w-md mx-auto">
        
        <div className="mb-6">
          <ErrorComponent error={error} />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
           {isRoot ? (
            <ButtonLink
              to="/"
              variant="outline"
              className="min-w-30"
            >
              Home
            </ButtonLink>
          ) : (
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="min-w-30"
            >
              Go Back
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => router.invalidate()}
            className="min-w-30"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  )
}