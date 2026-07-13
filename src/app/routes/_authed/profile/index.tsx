import { createFileRoute, Link } from '@tanstack/react-router'
import { Badge, Button, Card, Icon, PointsSummaryCard, SectionHeader } from '@/components/coeer'
import { getMyPointBalanceFn, getMyPointHistoryFn } from '~/functions'

export const Route = createFileRoute('/_authed/profile/')({
    loader: async ({ context }) => {
        const [balanceResult, historyResult] = await Promise.allSettled([
            getMyPointBalanceFn(),
            getMyPointHistoryFn({ data: { limit: 8, offset: 0 } }),
        ])
        return {
            user: context.user!,
            balance: balanceResult.status === 'fulfilled' ? balanceResult.value.data?.balance ?? 0 : 0,
            history: historyResult.status === 'fulfilled' ? historyResult.value.data?.items ?? [] : [],
        }
    },
    component: ProfileIndexComponent,
})

function ProfileIndexComponent() {
    const { user, balance, history } = Route.useLoaderData()

    return (
        <div className="space-y-6">
            <SectionHeader
                title="个人中心"
                description="查看账户、积分流水和成长状态。"
                action={<Link to="/logout"><Button variant="outline"><Icon name="logout" /> 退出</Button></Link>}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
                <Card className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--primary)/0.1)] text-2xl font-bold text-[hsl(var(--primary))]">
                            {(user.name || user.email).slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold">{user.name || 'COEER 成员'}</h2>
                            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{user.email}</p>
                            <div className="mt-2"><Badge tone="primary">{user.role}</Badge></div>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-[hsl(var(--border)/0.6)] p-4">
                            <div className="text-2xl font-bold">3</div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">加入群组</div>
                        </div>
                        <div className="rounded-lg border border-[hsl(var(--border)/0.6)] p-4">
                            <div className="text-2xl font-bold">8</div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">提交反馈</div>
                        </div>
                        <div className="rounded-lg border border-[hsl(var(--border)/0.6)] p-4">
                            <div className="text-2xl font-bold">2</div>
                            <div className="text-sm text-[hsl(var(--muted-foreground))]">成就解锁</div>
                        </div>
                    </div>
                </Card>

                <PointsSummaryCard balance={balance} />
            </div>

            <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-semibold">积分流水</h2>
                    <Badge>{history.length} 条</Badge>
                </div>
                <div className="divide-y divide-[hsl(var(--border)/0.65)]">
                    {history.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                            <div>
                                <div className="text-sm font-medium">{item.description || item.source}</div>
                                <div className="text-xs text-[hsl(var(--muted-foreground))]">{item.source}</div>
                            </div>
                            <div className={item.amount > 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}>
                                {item.amount > 0 ? '+' : ''}{item.amount}
                            </div>
                        </div>
                    ))}
                    {!history.length ? <p className="py-6 text-sm text-[hsl(var(--muted-foreground))]">暂无积分流水</p> : null}
                </div>
            </Card>
        </div>
    )
}
