import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, Card, Icon, type BadgeTone, type IconName } from '@/components/coeer'
import { getFeedbacksFn, listActivitiesFn, listAllGroupsFn, listRedeemItemsFn } from '~/functions'

export const Route = createFileRoute('/_authed/admin/')({
    loader: async () => {
        const [feedbacksResult, groupsResult, activitiesResult, redeemsResult] = await Promise.allSettled([
            getFeedbacksFn({ data: { status: 'pending', limit: 1, offset: 0 } }),
            listAllGroupsFn({ data: { status: 'pending', limit: 1, offset: 0 } }),
            listActivitiesFn({ data: { limit: 1, offset: 0 } }),
            listRedeemItemsFn({ data: { limit: 1, offset: 0 } }),
        ])

        return {
            pendingFeedbacks: feedbacksResult.status === 'fulfilled' ? feedbacksResult.value?.total ?? 0 : 0,
            pendingGroups: groupsResult.status === 'fulfilled' ? groupsResult.value?.total ?? 0 : 0,
            activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value?.data?.total ?? 0 : 0,
            redeemItems: redeemsResult.status === 'fulfilled' ? redeemsResult.value?.data?.total ?? 0 : 0,
        }
    },
    component: AdminDashboardPage,
})

type AdminLink = {
    to: '/admin/feedbacks' | '/admin/feedbacks/pending' | '/admin/stats' | '/admin/groups' | '/admin/groups/pending' | '/admin/bulletins' | '/admin/activities' | '/admin/redeems' | '/admin/achievements'
    title: string
    description: string
    icon: IconName
    badge: string
    tone: BadgeTone
}

const adminGroups: Array<{ title: string; links: AdminLink[] }> = [
    {
        title: '反馈中心',
        links: [
            { to: '/admin/feedbacks', title: '全部反馈', description: '检索与处理反馈', icon: 'feedback', badge: '管理', tone: 'primary' },
            { to: '/admin/feedbacks/pending', title: '待审核', description: '审核新提交反馈', icon: 'check', badge: '审核', tone: 'warning' },
            { to: '/admin/stats', title: '统计概览', description: '查看用户数据', icon: 'activity', badge: '数据', tone: 'primary' },
        ],
    },
    {
        title: '社区管理',
        links: [
            { to: '/admin/groups', title: '群组管理', description: '维护群组空间', icon: 'group', badge: '群组', tone: 'success' },
            { to: '/admin/groups/pending', title: '群组审核', description: '处理创建申请', icon: 'bookmark', badge: '审核', tone: 'warning' },
            { to: '/admin/bulletins', title: '公告管理', description: '发布与编辑公告', icon: 'bell', badge: '公告', tone: 'danger' },
        ],
    },
    {
        title: '运营中心',
        links: [
            { to: '/admin/activities', title: '活动管理', description: '管理活动报名', icon: 'calendar', badge: '活动', tone: 'primary' },
            { to: '/admin/redeems', title: '商城管理', description: '维护兑换物品', icon: 'gift', badge: '商城', tone: 'success' },
            { to: '/admin/achievements', title: '成就管理', description: '配置成长成就', icon: 'award', badge: '成就', tone: 'primary' },
        ],
    },
]

function AdminDashboardPage() {
    const metrics = Route.useLoaderData()
    const metricCards = [
        { label: '待审核反馈', value: metrics.pendingFeedbacks, icon: 'feedback' as IconName, tone: 'warning' as BadgeTone },
        { label: '待审核群组', value: metrics.pendingGroups, icon: 'group' as IconName, tone: 'warning' as BadgeTone },
        { label: '活动数量', value: metrics.activities, icon: 'calendar' as IconName, tone: 'primary' as BadgeTone },
        { label: '商城物品', value: metrics.redeemItems, icon: 'gift' as IconName, tone: 'success' as BadgeTone },
    ]

    return (
        <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {metricCards.map((item) => (
                    <Card key={item.label} className="rounded-xl p-5">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                                <Icon name={item.icon} />
                            </div>
                            <div>
                                <div className="text-2xl font-medium tabular-nums">{item.value}</div>
                                <div className="text-[13px] text-[hsl(var(--muted-foreground))]">{item.label}</div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {adminGroups.map((group, index) => (
                <section key={group.title} className="space-y-4">
                    {index > 0 ? <div className="h-px bg-[hsl(var(--border))]" /> : null}
                    <h2 className="text-[15px] font-medium">{group.title}</h2>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.links.map((item) => (
                            <Link key={item.to} to={item.to} className="block">
                                <Card className="group h-full rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                                            <Icon name={item.icon} />
                                        </div>
                                        <Badge tone={item.tone}>{item.badge}</Badge>
                                    </div>
                                    <div className="mt-4 flex items-start justify-between gap-3">
                                        <h3 className="text-[15px] font-medium">{item.title}</h3>
                                        <Icon name="chevron" className="h-4 w-4 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100" />
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{item.description}</p>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    )
}
