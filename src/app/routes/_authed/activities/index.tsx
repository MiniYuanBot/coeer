import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { ActivityCard, EmptyState, Pagination, activityStatusLabels, activityTypeLabels } from '@/components/coeer'
import { ActivityRegistrationButton } from '@/components/coeer/cards/ActivityRegistrationButton'
import { listActivitiesFn } from '~/functions'
import { ACTIVITY_STATUS_ARRAY, ACTIVITY_TYPE_ARRAY, ActivityStatus, ActivityType } from '@shared/constants'
import { useActivityClock } from '@/hooks/useActivityClock'
import { activityStatusAt } from '@shared/activities'

const searchSchema = z.object({
    type: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
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
    const { activities: loadedActivities, total } = Route.useLoaderData()
    const now = useActivityClock()
    const activities = loadedActivities.map((activity) => ({ ...activity, status: activityStatusAt(activity, now) }))
    const router = useRouter()
    const timeStatusChanged = activities.some((activity, index) => activity.status !== loadedActivities[index].status)
    useEffect(() => { if (timeStatusChanged) void router.invalidate() }, [timeStatusChanged, router])
    const { type, status, search, page } = Route.useSearch()
    const navigate = Route.useNavigate()

    const go = (next: { type?: string; status?: string; search?: string; page?: number }) => {
        navigate({ to: '/activities', search: previous => ({ ...previous, page: 1, ...next }) })
    }

    return (
        <PageLayout title="活动"
            scope={{ title: '活动范围', items: [{ key: 'all', label: '全部活动', active: true, onClick: () => go({ page: 1 }) }] }}
            description="参与学院活动、共创圆桌和学习小组，获得成长积分。"
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索活动标题、内容或地点",
                onSearch: (value) => go({ search: value || undefined }),
                onClear: () => go({ search: undefined, type: undefined, status: undefined }),
                groups: [
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
                ]
            }}>

            {activities.length ? (
                <div className="coeer-grid">
                    {activities.map((activity: any) => (
                        <ActivityCard
                            key={activity.id}
                            activity={activity}
                            action={<ActivityRegistrationButton activity={activity} />}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState title="暂无活动" description="活动发布后会出现在这里。" />
            )}
            <Pagination total={total} page={page} size={9} onChange={(page) => go({ page })} />
        </PageLayout>
    )
}
