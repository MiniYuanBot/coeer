import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/profile/')({
    component: ProfileIndexComponent,
    beforeLoad: ({ context }) => {
        if (!context.user) {
            throw redirect({ href: '/login' })
        }
    },
})

function ProfileIndexComponent() {
    const { user } = Route.useRouteContext()

    if (!user) {
        return null
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <h1 className="text-2xl font-bold mb-6">个人资料</h1>

            <div className="space-y-4 bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
                <div className="flex items-center gap-4">
                    <span className="text-gray-500 w-20">邮箱：</span>
                    <span className="font-medium">{user.email}</span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-gray-500 w-20">角色：</span>
                    <span className="font-medium">{user.role}</span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-gray-500 w-20">姓名：</span>
                    <span className="font-medium">{user.name || '未设置'}</span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-gray-500 w-20">更新时间：</span>
                    <span className="font-medium text-sm text-gray-400">
                        {user.lastUpdated
                            ? new Date(user.lastUpdated).toLocaleString()
                            : '未知'}
                    </span>
                </div>
            </div>
        </div>
    )
}