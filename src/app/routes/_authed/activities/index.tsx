import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ActivityCard, Badge, Button, Card, EmptyState, Icon, SectionHeader, useAsyncAction } from '@/components/coeer'
import { listActivitiesFn, registerActivityFn } from '~/functions'

const searchSchema = z.object({
    status: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/activities/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const result = await listActivitiesFn({
            data: {
                status: search.status as any,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return { activities: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: ActivitiesPage,
})

function ActivitiesPage() {
    const { activities, total } = Route.useLoaderData()
    const { loadingKey, run } = useAsyncAction()

    return (
        <div className="space-y-6">
            <SectionHeader title="活动" description="参与学院活动、共创圆桌和学习小组，获得成长积分。" />
            <Card className="flex flex-wrap items-center gap-2 p-4">
                <Badge tone="primary">全部 {total}</Badge>
                <Badge>即将开始</Badge>
                <Badge>已完成</Badge>
            </Card>
            {activities.length ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activities.map((activity: any) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            action={
                                <Button
                                    className="w-full"
                                    loading={loadingKey === activity.id}
                                    disabled={activity.status === 'completed'}
                                    onClick={() => run(activity.id, () => registerActivityFn({ data: { activityId: activity.id } }), {
                                        success: '报名成功',
                                        error: '报名失败',
                                    })}
                                >
                                    <Icon name="check" /> 报名
                                </Button>
                            }
                        />
                    ))}
                </div>
            ) : (
                <EmptyState title="暂无活动" description="活动发布后会出现在这里。" />
            )}
        </div>
    )
}
