import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
import { getGroupBySlugFn, checkRoleFn } from '~/functions'
import { Badge, NavTabs, navTabClass, activeNavTabClass, groupCategoryLabels } from '@/components/coeer'

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
            <section aria-label="群组信息" className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted text-base font-medium">
                                {group.name[0]}
                            </div>
                            <div className="min-w-0">
                                <h1 className="break-words text-[22px] font-semibold leading-snug tracking-tight">{group.name}</h1>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge>{groupCategoryLabels[group.category] || group.category}</Badge>
                                    <Badge tone={group.isPublic ? 'success' : 'default'}>{group.isPublic ? '公开' : '私密'}</Badge>
                                    <span className="text-[13px] text-[hsl(var(--muted-foreground))]">{group.memberCount} 名成员</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <NavTabs label="群组导航">
                        <Link
                            to="/groups/$slug"
                            params={{ slug }}
                            activeOptions={{ exact: true }}
                            activeProps={{ className: activeNavTabClass }}
                            className={navTabClass}
                        >
                            主页
                        </Link>
                        <Link
                            to="/groups/$slug/members"
                            params={{ slug }}
                            activeProps={{ className: activeNavTabClass }}
                            className={navTabClass}
                        >
                            成员
                        </Link>
                        <Link
                            to="/groups/$slug/posts"
                            params={{ slug }}
                            activeProps={{ className: activeNavTabClass }}
                            className={navTabClass}
                        >
                            帖子
                        </Link>
                        {isAdmin && (
                            <>
                                <Link
                                    to="/groups/$slug/admin"
                                    params={{ slug }}
                                    activeProps={{ className: activeNavTabClass }}
                                    className={navTabClass}
                                >
                                    管理
                                </Link>
                                <Link
                                    to="/groups/$slug/settings"
                                    params={{ slug }}
                                    activeProps={{ className: activeNavTabClass }}
                                    className={navTabClass}
                                >
                                    设置
                                </Link>
                            </>
                        )}
                    </NavTabs>
            </section>

            <Outlet />
        </div>
    )
}
