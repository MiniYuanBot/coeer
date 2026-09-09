import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Card, Icon } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/admin')({
    beforeLoad: ({ context, params }) => {
        // 管理页只对群管理员开放（此前的实现未做前端守卫，
        // 且误把“全平台群组审核”列表展示在群组内部，已移除）。
        if (!context.isAdmin) {
            throw redirect({
                to: '/groups/$slug',
                params: { slug: params.slug },
            })
        }
    },
    component: GroupAdminPage,
})

function GroupAdminPage() {
    const { group } = Route.useRouteContext()
    const { slug } = Route.useParams()

    const stats = [
        { label: '成员数', value: String(group.memberCount), hint: '已通过审核的成员' },
        { label: '帖子数', value: String(group.postCount || 0), hint: '讨论与公告' },
        { label: '创建时间', value: new Date(group.createdAt).toLocaleDateString(), hint: '' },
    ]

    return (
        <div className="space-y-6">
            <Card className="rounded-xl p-5">
                <h2 className="mb-4 text-[15px] font-medium">群组统计</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    {stats.map((item) => (
                        <div key={item.label} className="rounded-xl border border-border p-4">
                            <p className="text-2xl font-medium tabular-nums">{item.value}</p>
                            <p className="text-[13px] text-muted-foreground">{item.label}</p>
                            {item.hint ? (
                                <p className="mt-1 text-xs text-muted-foreground/70">{item.hint}</p>
                            ) : null}
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="rounded-xl p-5">
                <h2 className="mb-4 text-[15px] font-medium">管理入口</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                        to="/groups/$slug/members"
                        params={{ slug }}
                        className="coeer-focus flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted"
                    >
                        <Icon name="group" className="h-5 w-5 text-primary" />
                        <div>
                            <div className="text-sm font-medium">成员审核</div>
                            <div className="text-xs text-muted-foreground">审批入群申请、调整角色与移除成员</div>
                        </div>
                    </Link>
                    <Link
                        to="/groups/$slug/settings"
                        params={{ slug }}
                        className="coeer-focus flex items-center gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted"
                    >
                        <Icon name="spark" className="h-5 w-5 text-primary" />
                        <div>
                            <div className="text-sm font-medium">群组设置</div>
                            <div className="text-xs text-muted-foreground">编辑资料、解散群组</div>
                        </div>
                    </Link>
                </div>
            </Card>
        </div>
    )
}
