import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Login } from 'src/app/components/basic'

export const Route = createFileRoute('/_authed/admin')({
    beforeLoad: ({ context }) => {
        if (context.user?.role !== 'admin') {
            throw new Error('Admin access denied')
        }
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Not authenticated') {
            return <Login />
        }

        if (error.message === 'Admin access denied') {
            return (
                <div className="p-8 text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
                    <p className="text-gray-600">You are NOT allowed to access this</p>
                    <a href="/" className="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                        Go back home
                    </a>
                </div>
            )
        }

        throw error
    },
    component: AdminLayout,
})

function AdminLayout() {
    return (
        <div className="admin-layout">
            <nav className="admin-nav">
                <div className="flex space-x-4 border-b">
                    <a href="/admin" className="px-4 py-2">主页</a>
                </div>
            </nav>

            <Outlet />
        </div>
    )
}