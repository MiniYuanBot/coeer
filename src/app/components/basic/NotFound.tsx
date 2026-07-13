import { Link } from '@tanstack/react-router'
import { Button } from '../coeer'

export function NotFound({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-w-30 flex flex-col items-center justify-center text-center p-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-9xl font-black text-gray-200 dark:text-gray-700 select-none">
          404
        </h1>
        <div className="mt-4 text-xl text-gray-600 dark:text-gray-300">
          {children || (
            <>
              <p className="font-semibold">Page Not Found</p>
              <p className="text-base mt-2">
                The page you are looking for might have been removed, had its name changed,
                or is temporarily unavailable.
              </p>
            </>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/">
            <Button variant="outline" className="min-w-30">Home</Button>
          </Link>
          <Button
            variant="primary"
            onClick={() => window.history.back()}
            className="min-w-30"
          >Go Back</Button>
        </div>
      </div>
    </div>
  )
}
