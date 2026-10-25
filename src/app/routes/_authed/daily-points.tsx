import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getDailyPointTasksFn, recordDailyVisitFn } from '~/functions/points'
import { Button, Card, Icon, PageLayout } from '@/components/coeer'
import type { IconName } from '@/components/coeer/lib/types'
import type { EngagementAction } from '@shared/constants/engagement'

export const Route = createFileRoute('/_authed/daily-points')({
    loader: async () => { await recordDailyVisitFn(); return getDailyPointTasksFn() },
    component: DailyPointsPage,
})
const links: Record<EngagementAction, { to: '/daily-points' | '/feedbacks' | '/groups' | '/activities'; label: string; hint: string }> = {
    daily: { to: '/daily-points', label: '今日已访问', hint: '每天访问社区，自动获得积分。' },
    feedback: { to: '/feedbacks', label: '提交反馈', hint: '提交校园建议或问题反馈。' },
    post: { to: '/groups', label: '去发帖', hint: '在已加入的群组发布帖子。' },
    reply: { to: '/groups', label: '去交流', hint: '在群组帖子下参与讨论。' },
    attendance: { to: '/activities', label: '查看活动', hint: '参加活动，由主办方或管理员确认签到。' },
}
const taskIcons: Record<EngagementAction, IconName> = { daily: 'sun', feedback: 'feedback', post: 'group', reply: 'comment', attendance: 'calendar' }
function DailyPointsPage() {
    const initial = Route.useLoaderData()
    const { user } = Route.useRouteContext()
    const { data = initial, isError, refetch } = useQuery({ queryKey: ['daily-points', user!.id], initialData: initial,
        queryFn: async () => { await recordDailyVisitFn(); return getDailyPointTasksFn() }, refetchInterval: 60_000, staleTime: 0 })
    const earned = data.tasks.reduce((sum, task) => sum + task.completed * task.amount, 0)
    const total = data.tasks.reduce((sum, task) => sum + task.dailyLimit * task.amount, 0)
    const completedTasks = data.tasks.filter(task => task.completed >= task.dailyLimit).length
    return <PageLayout title="每日积分" description="每天参与一点，让成长看得见。每日额度按北京时间零点重置。">
        <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div><p className="text-xs text-muted-foreground">{data.day} · 今日已获得</p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{earned}<span className="ml-2 text-sm font-normal text-muted-foreground">积分 / {total}</span></p>
                </div>
                <p className="text-xs text-muted-foreground">已完成 <span className="font-medium tabular-nums text-foreground">{completedTasks} / {data.tasks.length}</span> 项任务</p>
            </div>
            <div className="mt-5"><progress aria-label="今日积分进度" max={total} value={earned} className="coeer-task-progress" /></div>
        </Card>
        {isError && <p role="alert">进度刷新失败。<Button variant="ghost" onClick={() => void refetch()}>重试</Button></p>}
        <Card className="divide-y divide-border">{data.tasks.map(task => {
            const done = task.completed >= task.dailyLimit
            const action = links[task.action]
            return <article key={task.action} className="flex gap-3 p-4 sm:gap-4 sm:p-5">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon name={taskIcons[task.action]} className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1 sm:flex sm:items-center sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-sm font-semibold">{task.label}</h2><span className="text-xs tabular-nums text-muted-foreground">+{task.amount} 积分 / 次</span></div>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{action.hint}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4 sm:mt-0 sm:shrink-0 sm:gap-6">
                        <div className="w-24 shrink-0 space-y-2 sm:w-28">
                            <p className="flex justify-between text-xs tabular-nums text-muted-foreground"><span>{task.completed} / {task.dailyLimit} 次</span><span>+{task.completed * task.amount}</span></p>
                            <progress aria-label={`${task.label}进度`} value={task.completed} max={task.dailyLimit} className="coeer-task-progress" />
                        </div>
                        <div className="flex min-w-20 justify-end">
                            {done ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"><Icon name="check" />今日已完成</span> : <Button asChild size="sm" variant="outline"><Link to={action.to}>{action.label}</Link></Button>}
                        </div>
                    </div>
                </div>
            </article>
        })}</Card>
    </PageLayout>
}
