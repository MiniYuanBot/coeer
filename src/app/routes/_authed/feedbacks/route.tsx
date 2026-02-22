import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/feedbacks')({
  component: FeedbacksLayout,
})

function FeedbacksLayout() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">This is the Fuckback Layout</h1>
      </div>
      <Outlet />
    </div>
  )
}
