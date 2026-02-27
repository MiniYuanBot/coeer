import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
    beforeLoad: ({ context }) => {
        if (context.user?.role !== 'admin') {
            throw new Error('Permission denied')
        }
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Permission denied') {
            throw redirect({ to: '/' })
        }

        throw error
    },
    component: AdminLayout,
})

function AdminLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600 mt-1">Manage feedbacks and view system statistics</p>
                </div>
                <Outlet />
            </div>
        </div>
    )
}