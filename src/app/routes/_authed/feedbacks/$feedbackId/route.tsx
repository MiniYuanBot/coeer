import { createFileRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId')({
    component: FeedbackDetailLayout,
})

function FeedbackDetailLayout() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <Link to="/feedbacks" className="hover:text-blue-600">
                    ← Back to Feedbacks
                </Link>
            </div>
            <Outlet />
        </div>
    )
}