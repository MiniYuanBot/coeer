import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/groups')({
    component: GroupsLayout,
})

function GroupsLayout() {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">群组</h1>
                <Link
                    to="/groups/create"
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                    创建群组
                </Link>
            </div>

            <div className="flex border-b mb-6">
                <Link
                    to="/groups/all"
                    activeProps={{ className: 'border-b-2 border-blue-600 text-blue-600' }}
                    inactiveProps={{ className: 'text-gray-600' }}
                    className="px-4 py-2"
                >
                    所有公开群组
                </Link>
                <Link
                    to="/groups/my"
                    activeProps={{ className: 'border-b-2 border-blue-600 text-blue-600' }}
                    inactiveProps={{ className: 'text-gray-600' }}
                    className="px-4 py-2"
                >
                    我加入的群组
                </Link>
            </div>

            <Outlet />
        </div>
    )
}