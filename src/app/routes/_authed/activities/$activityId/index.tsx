import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { Markdown } from '@/components/coeer/ui/Markdown'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, DetailLayout, EmptyState, Icon, activityStatusLabels, activityTypeLabels, formatDateTime } from '@/components/coeer'
import { ActivityRegistrationButton } from '@/components/coeer/cards/ActivityRegistrationButton'
import { getActivityByIdFn } from '~/functions'
import { useActivityClock } from '@/hooks/useActivityClock'
import { activityStatusAt } from '@shared/activities'

export const Route = createFileRoute('/_authed/activities/$activityId/')({
    loader: async ({ params }) => {
        const result = await getActivityByIdFn({ data: { id: params.activityId } })
        return { activity: result.data }
    },
    component: ActivityDetailPage,
})

function ActivityDetailPage() {
    const { activity: loadedActivity } = Route.useLoaderData()
    const now = useActivityClock()
    const activity = loadedActivity ? { ...loadedActivity, status: activityStatusAt(loadedActivity, now) } : undefined
    if (!activity) return <EmptyState title="活动不存在" />

    return (
        <PageLayout title={activity.title}
            description={activityTypeLabels[activity.type] || '学院活动'}
            action={<Badge tone={activity.status === 'ongoing' ? 'success' : activity.status === 'upcoming' ? 'primary' : 'default'}>{activityStatusLabels[activity.status] || activity.status}</Badge>}>

            <DetailLayout asideFirstOnMobile asideLabel="活动信息与报名" aside={
                <Card className="space-y-5 p-5">
                    <h2 className="text-sm font-semibold">活动信息</h2>
                    <dl className="space-y-4 text-[13px]">
                        <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="calendar" className="h-3.5 w-3.5" />开始时间</dt><dd className="mt-1.5 leading-6 tabular-nums">{formatDateTime(activity.startTime)}</dd></div>
                        {activity.endTime ? <div><dt className="text-xs text-muted-foreground">结束时间</dt><dd className="mt-1.5 leading-6 tabular-nums">{formatDateTime(activity.endTime)}</dd></div> : null}
                        <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name="bookmark" className="h-3.5 w-3.5" />活动地点</dt><dd className="mt-1.5 leading-6">{activity.location || '待定地点'}</dd></div>
                    </dl>
                    <ActivityRegistrationButton activity={activity} label="报名参加" />
                </Card>
            }>
            <Card className="p-5 sm:p-6">
                <h2 className="text-sm font-semibold">活动说明</h2>
                <Markdown content={activity.description} className="mt-4 max-w-[76ch]" />
            </Card>
            </DetailLayout>
        </PageLayout>
    )
}
