import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/')({
    component: AdminDashboardPage,
})

function AdminDashboardPage() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
                to="/admin/feedbacks"
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">All Feedbacks</h3>
                <p className="text-gray-600">View and manage all user feedbacks</p>
            </Link>

            <Link
                to="/admin/feedbacks/pending"
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Pending Review</h3>
                <p className="text-gray-600">Feedbacks awaiting admin action</p>
            </Link>

            <Link
                to="/admin/stats"
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Statistics</h3>
                <p className="text-gray-600">View feedback system analytics</p>
            </Link>
        </div>
    )
}