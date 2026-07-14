import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { ActivityCard, Button, EmptyState, FilterPanel, Icon, SectionHeader, activityStatusLabels, activityTypeLabels, useAsyncAction } from '@/components/coeer'
import { listActivitiesFn, registerActivityFn } from '~/functions'
import { ACTIVITY_STATUS_ARRAY, ACTIVITY_TYPE_ARRAY, ActivityStatus, ActivityType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/activities/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const result = await listActivitiesFn({
            data: {
                type: search.type as any,
                status: search.status as any,
                search: search.search,
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
    const { type, status, search } = Route.useSearch()
    const navigate = useNavigate()
    const { loadingKey, run } = useAsyncAction()

    const go = (next: { type?: string; status?: string; search?: string; page?: number }) => {
        navigate({ to: '/activities', search: { type, status, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="活动" description="参与学院活动、共创圆桌和学习小组，获得成长积分。" />
            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索活动标题、内容或地点"
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '类型',
                        items: [
                            { key: 'all-types', label: '全部', active: !type, onClick: () => go({ type: undefined }) },
                            ...ACTIVITY_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: activityTypeLabels[item],
                                active: type === item,
                                onClick: () => go({ type: item as ActivityType }),
                            })),
                        ],
                    },
                    {
                        title: '状态',
                        items: [
                            { key: 'all-status', label: '全部状态', active: !status, onClick: () => go({ status: undefined }) },
                            ...ACTIVITY_STATUS_ARRAY.map((item) => ({
                                key: item,
                                label: activityStatusLabels[item],
                                active: status === item,
                                onClick: () => go({ status: item as ActivityStatus }),
                            })),
                        ],
                    },
                ]}
            />
            {activities.length ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activities.map((activity: any) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            action={
                                <Button
                                    className="w-full"
                                    variant={activity.status === 'completed' || activity.status === 'cancelled' ? 'ghost' : 'primary'}
                                    loading={loadingKey === activity.id}
                                    disabled={activity.status === 'completed' || activity.status === 'cancelled'}
                                    onClick={() => run(activity.id, () => registerActivityFn({ data: { activityId: activity.id } }), {
                                        success: '报名成功',
                                        error: '报名失败',
                                    })}
                                >
                                    <Icon name="check" /> {activity.status === 'completed' || activity.status === 'cancelled' ? '已结束' : '报名'}
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
