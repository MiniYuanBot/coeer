import { createFileRoute } from '@tanstack/react-router'
import { ActivityCard, Button, Card, EmptyState, Icon, SectionHeader, useAsyncAction } from '@/components/coeer'
import { getActivityByIdFn, registerActivityFn } from '~/functions'

export const Route = createFileRoute('/_authed/activities/$activityId/')({
    loader: async ({ params }) => {
        const result = await getActivityByIdFn({ data: { id: params.activityId } })
        return { activity: result.data }
    },
    component: ActivityDetailPage,
})

function ActivityDetailPage() {
    const { activity } = Route.useLoaderData()
    const { loadingKey, run } = useAsyncAction()
    if (!activity) return <EmptyState title="活动不存在" />

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <SectionHeader title={activity.title} description="活动详情与报名" />
            <ActivityCard
                activity={activity}
                action={
                    <Button
                        loading={loadingKey === activity.id}
                        onClick={() => run(activity.id, () => registerActivityFn({ data: { activityId: activity.id } }), {
                            success: '报名成功',
                            error: '报名失败',
                        })}
                    >
                        <Icon name="check" /> 报名参加
                    </Button>
                }
            />
            <Card className="rounded-xl p-5">
                <h2 className="text-[15px] font-medium">活动说明</h2>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{activity.description}</p>
            </Card>
        </div>
    )
}
