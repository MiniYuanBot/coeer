import { Button } from './Button/Button'
import { Link } from '@tanstack/react-router'

export function AuthForm({
  actionText,
  onSubmit,
  status,
  afterSubmit,
}: {
  actionText: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  status: 'pending' | 'idle' | 'success' | 'error'
  afterSubmit?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-gray-50 dark:bg-gray-950 flex items-start justify-center p-8 overflow-auto">
      <div className="bg-white dark:bg-gray-900 p-10 rounded-lg shadow-2xl mt-24">
        <h1 className="text-2xl font-bold mb-4">{actionText}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(e)
          }}
          className="space-y-5"
        >
          <div>
            <label htmlFor="email" className="block text-xs">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              className="px-2 py-1 w-full rounded-sm border border-gray-500/20 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              className="px-2 py-1 w-full rounded-sm border border-gray-500/20 bg-white dark:bg-gray-800"
            />
          </div>
          <Button variant="primary" loading={status === 'pending'} className="w-full">{actionText}</Button>
          {afterSubmit ? afterSubmit : null}
          <Link to="/" className="text-sm text-blue-400 hover:underline hover:text-blue-600"> back to home</Link>
        </form>
      </div>
    </div>
  )
}
