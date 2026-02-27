import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { getGroupBySlugFn, isRoleFn } from '~/functions'

export const Route = createFileRoute('/_authed/groups/$slug')({
    beforeLoad: async ({ params, context }) => {
        const group = await getGroupBySlugFn({ data: { slug: params.slug } })
        if (!group) {
            throw new Error('Group not found')
        }

        const user = context.user!
        const isAdmin = await isRoleFn({ data: { groupId: group.id, userId: user.id, role: 'admin' } })
        const isMember = await isRoleFn({ data: { groupId: group.id, userId: user.id, role: 'member' } })

        return { group, isAdmin, isMember }
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Group not found') {
            throw redirect({ to: '/groups' })
        }

        throw error
    },
    component: GroupLayout,
})

function GroupLayout() {
    const { group, isAdmin } = Route.useRouteContext()
    const { slug } = Route.useParams()

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="py-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* {group.avatarUrl ? (
                                <img
                                    src={group.avatarUrl}
                                    alt=""
                                    className="w-16 h-16 rounded-full object-cover"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl font-bold">
                                    {group.name[0]}
                                </div>
                            )} */}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
                                <p className="text-sm text-gray-500">
                                    {group.category} · {group.isPublic ? '公开' : '私密'} · {group.memberCount} 成员
                                </p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex gap-6 -mb-px">
                        <Link
                            to="/groups/$slug"
                            params={{ slug }}
                            activeOptions={{ exact: true }}
                            activeProps={{ className: 'border-blue-500 text-blue-600' }}
                            className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        >
                            主页
                        </Link>
                        <Link
                            to="/groups/$slug/members"
                            params={{ slug }}
                            activeProps={{ className: 'border-blue-500 text-blue-600' }}
                            className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                        >
                            成员
                        </Link>
                        {isAdmin && (
                            <>
                                <Link
                                    to="/groups/$slug/admin"
                                    params={{ slug }}
                                    activeProps={{ className: 'border-blue-500 text-blue-600' }}
                                    className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                >
                                    管理
                                </Link>
                                <Link
                                    to="/groups/$slug/settings"
                                    params={{ slug }}
                                    activeProps={{ className: 'border-blue-500 text-blue-600' }}
                                    className="py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                >
                                    设置
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </div>
        </div>
    )
}