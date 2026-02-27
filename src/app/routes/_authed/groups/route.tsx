import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/groups')({
    component: GroupsLayout,
})

function GroupsLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex gap-8">
                    <aside className="w-64 flex-shrink-0">
                        <nav className="space-y-1">
                            <Link
                                to="/groups/all"
                                activeProps={{ className: 'bg-gray-100 text-gray-900' }}
                                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            >
                                发现群组
                            </Link>
                            <Link
                                to="/groups/my"
                                activeProps={{ className: 'bg-gray-100 text-gray-900' }}
                                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            >
                                我的群组
                            </Link>
                            <Link
                                to="/groups/create"
                                activeProps={{ className: 'bg-gray-100 text-gray-900' }}
                                className="block px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            >
                                创建群组
                            </Link>
                        </nav>
                    </aside>
                    <main className="flex-1 min-w-0">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}