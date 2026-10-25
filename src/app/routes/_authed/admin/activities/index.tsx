import { DataTable, RowActions, PageLayout, StatusBadge } from '@/components/coeer'
import { formatDate } from '@/components/coeer'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { ACTIVITY_TYPE_ARRAY } from '@shared/constants'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Icon, Pagination } from '@/components/coeer'
import { activityStatusLabels, activityTypeLabels } from '@/components/coeer'
import { deleteActivityFn, adminListActivityParticipantsFn, listActivitiesFn } from '~/functions'

const searchSchema = z.object({ scope: z.enum(['all', 'participants']).default('all'), type: z.enum(ACTIVITY_TYPE_ARRAY).optional(), search: z.string().optional(), page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/activities/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const data = { type: search.type, search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize }
        if (search.scope === 'participants') {
            const result = await adminListActivityParticipantsFn({ data })
            if (!result.success) throw new Error(result.state.message)
            return { activities: [], participants: result.data?.items ?? [], total: result.data?.total ?? 0 }
        }
        const result = await listActivitiesFn({ data })
        if (!result.success) throw new Error(result.state.message)
        return { activities: result.data?.items ?? [], participants: [], total: result.data?.total ?? 0 }
    },
    component: AdminActivitiesPage,
})

function AdminActivitiesPage() {
    const { activities, participants, total = 0 } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { page, scope, type, search } = filters
    const navigate = useNavigate()
    const router = useRouter()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/activities', search: { ...filters, page: 1, ...next } })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const refresh = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/activities', search: filters })
    }

    const remove = async (id: string) => {
        if (pending || !confirm('确定删除这个活动吗？')) return
        setPending(true)
        setError('')
        try {
            const result = await deleteActivityFn({ data: { id } })
            if (!result.success) throw new Error(result.state.message || '删除活动失败')
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除活动失败') }
        finally { setPending(false) }
    }

    return <PageLayout title="活动管理"
            description="发布、编辑、删除活动，并查看报名情况。"
            action={<Button asChild><Link to="/admin/activities/create" search={{ page }}><Icon name="plus" />新建活动</Link></Button>}
            scope={{ title: '活动管理范围', items: [{ key: 'all', label: '全部活动', active: scope === 'all', onClick: () => go({ scope: 'all' }) }, { key: 'participants', label: '报名情况', active: scope === 'participants', onClick: () => go({ scope: 'participants' }) }] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索活动标题",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, type: undefined }),
                groups: [filterGroup('类型', ACTIVITY_TYPE_ARRAY, activityTypeLabels, type, type => go({ type }))]
            }}>

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {scope === 'participants' ? <DataTable label="活动报名表" rows={participants} rowKey={item => item.id} emptyTitle="暂无报名记录" columns={[
            { key: 'activity', header: '活动', render: item => <span className="font-medium">{item.activity.title}</span> },
            { key: 'user', header: '报名人', width: '10rem', render: item => item.user?.name || '未知用户' },
            { key: 'status', header: '状态', width: '8rem', render: item => <StatusBadge status={item.status} labels={{ registered: '已报名', attended: '已签到', cancelled: '已取消' }} /> },
            { key: 'time', header: '报名时间', width: '8rem', render: item => formatDate(item.registeredAt) },
        ]} /> : <DataTable label="活动管理表" rows={activities} rowKey={item => item.id} emptyTitle="暂无活动" columns={[
            { key: 'title', header: '活动', render: item => <span className="font-medium">{item.title}</span> },
            { key: 'type', header: '类型', width: '8rem', render: item => activityTypeLabels[item.type] },
            { key: 'status', header: '状态', width: '7rem', render: item => <StatusBadge status={item.status} labels={activityStatusLabels} /> },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: item => <RowActions><Button size="sm" asChild variant="outline"><Link to="/admin/activities/$activityId/edit" params={{ activityId: item.id }} search={{ page }}>编辑</Link></Button><Button size="sm" variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></RowActions> },
        ]} />}
            <Pagination total={total} page={page} size={20} onChange={page => go({ page })} />

    </PageLayout>
}
