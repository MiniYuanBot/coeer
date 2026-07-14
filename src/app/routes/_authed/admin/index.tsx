import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, Card, Icon } from '@/components/coeer'

export const Route = createFileRoute('/_authed/admin/')({
    component: AdminDashboardPage,
})

const adminLinks = [
    {
        to: '/admin/feedbacks' as const,
        title: '全部反馈',
        description: '按状态和关键词检索反馈，更新处理进度或删除无效记录。',
        icon: 'feedback' as const,
        badge: '管理',
    },
    {
        to: '/admin/feedbacks/pending' as const,
        title: '待审核',
        description: '快速通过公开、进入处理或驳回新提交的反馈。',
        icon: 'check' as const,
        badge: '审核',
    },
    {
        to: '/admin/stats' as const,
        title: '统计概览',
        description: '查看反馈总量、状态分布和平均解决时长。',
        icon: 'activity' as const,
        badge: '数据',
    },
    {
        to: '/admin/groups' as const,
        title: '群组管理',
        description: '查看已通过群组，清理不再需要的组织空间。',
        icon: 'group' as const,
        badge: '群组',
    },
    {
        to: '/admin/groups/pending' as const,
        title: '群组审核',
        description: '处理用户创建群组的申请，通过或退回待完善内容。',
        icon: 'bookmark' as const,
        badge: '审核',
    },
]

function AdminDashboardPage() {
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {adminLinks.map((item) => (
                <Link key={item.to} to={item.to} className="block">
                    <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                                <Icon name={item.icon} />
                            </div>
                            <Badge tone="primary">{item.badge}</Badge>
                        </div>
                        <h2 className="mt-4 font-semibold">{item.title}</h2>
                        <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{item.description}</p>
                    </Card>
                </Link>
            ))}
        </div>
    )
}
