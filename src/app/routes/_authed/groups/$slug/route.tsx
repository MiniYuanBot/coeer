import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { getGroupBySlugFn, checkRoleFn } from '~/functions'
import { Badge, Card, groupCategoryLabels } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug')({
    beforeLoad: async ({ params, context }) => {
        const group = await getGroupBySlugFn({ data: { slug: params.slug } })
        if (!group) {
            throw new Error('Group not found')
        }

        const user = context.user!
        const isAdmin = await checkRoleFn({ data: { groupId: group.id, userId: user.id, role: 'admin' } })
        const isMember = await checkRoleFn({ data: { groupId: group.id, userId: user.id, role: 'member' } })

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
        <div className="space-y-6">
            <Card className="overflow-hidden rounded-xl">
                <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="grid h-12 w-12 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-xl font-medium text-[hsl(var(--primary))]">
                                {group.name[0]}
                            </div>
                            <div>
                                <h1 className="text-[28px] font-medium leading-tight">{group.name}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge>{groupCategoryLabels[group.category] || group.category}</Badge>
                                    <Badge tone={group.isPublic ? 'success' : 'default'}>{group.isPublic ? '公开' : '私密'}</Badge>
                                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{group.memberCount} 名成员</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <nav className="mt-5 flex gap-2 overflow-x-auto border-t border-[hsl(var(--border))] pt-4">
                        <Link
                            to="/groups/$slug"
                            params={{ slug }}
                            activeOptions={{ exact: true }}
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.24)]' }}
                            className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                            主页
                        </Link>
                        <Link
                            to="/groups/$slug/members"
                            params={{ slug }}
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.24)]' }}
                            className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                            成员
                        </Link>
                        <Link
                            to="/groups/$slug/posts"
                            params={{ slug }}
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.24)]' }}
                            className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                        >
                            帖子
                        </Link>
                        {isAdmin && (
                            <>
                                <Link
                                    to="/groups/$slug/admin"
                                    params={{ slug }}
                                    activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.24)]' }}
                                    className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    管理
                                </Link>
                                <Link
                                    to="/groups/$slug/settings"
                                    params={{ slug }}
                                    activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] border-[hsl(var(--primary)/0.24)]' }}
                                    className="shrink-0 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                                >
                                    设置
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            </Card>

            <Outlet />
        </div>
    )
}
