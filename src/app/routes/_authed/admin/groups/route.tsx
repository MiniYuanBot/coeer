import { createFileRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/groups')({
    component: AdminGroupsLayout,
})

function AdminGroupsLayout() {
    return (
        <div className="admin-layout">
            <nav className="admin-nav">
                <div className="flex space-x-4 border-b">
                    <Link to="/admin/groups" className="px-4 py-2">所有群组</Link>
                    <Link to="/admin/groups/pending" className="px-4 py-2">待审核</Link>
                </div>
            </nav>

            <Outlet />
        </div>
    )
}