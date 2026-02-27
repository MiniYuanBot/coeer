import { createFileRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/feedbacks')({
    component: AdminFeedbacksLayout,
})

function AdminFeedbacksLayout() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
                <Link
                    to="/admin/feedbacks"
                    className="text-sm font-medium text-gray-600 hover:text-blue-600 pb-4 border-b-2 border-transparent hover:border-blue-600 -mb-4"
                    activeProps={{ className: 'text-blue-600 border-blue-600' }}
                >
                    All Feedbacks
                </Link>
                <Link
                    to="/admin/feedbacks/pending"
                    className="text-sm font-medium text-gray-600 hover:text-blue-600 pb-4 border-b-2 border-transparent hover:border-blue-600 -mb-4"
                    activeProps={{ className: 'text-blue-600 border-blue-600' }}
                >
                    Pending Review
                </Link>
            </div>
            <Outlet />
        </div>
    )
}