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

  console.error(error)

  return (
    <div className="min-w-30 flex flex-col items-center justify-center text-center p-8">
      <div className="max-w-md mx-auto">
        
        <div className="mb-6">
          <ErrorComponent error={error} />
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
           {isRoot ? (
            <Link to="/">
              <Button variant="outline" className="min-w-30">Home</Button>
            </Link>
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
