import { DataTable, RowActions, PageLayout, VisibilityBadge } from '@/components/coeer'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY } from '@shared/constants'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Icon, Pagination } from '@/components/coeer'
import { resolveAchievementCondition } from '@shared/constants'
import { achievementConditionTypeLabels } from '@/components/coeer'
import { adminDeleteAchievementFn, adminListAchievementsFn } from '~/functions'

const searchSchema = z.object({ scope: z.enum(['all', 'public', 'hidden']).default('all'), conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(), search: z.string().optional(), page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/achievements/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await adminListAchievementsFn({ data: { conditionType: search.conditionType, isHidden: search.scope === 'all' ? undefined : search.scope === 'hidden', search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { achievements: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminAchievementsPage,
})

function AdminAchievementsPage() {
    const { achievements, total } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { page, scope, conditionType, search } = filters
    const navigate = useNavigate()
    const router = useRouter()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/achievements', search: { ...filters, page: 1, ...next } })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const refresh = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/achievements', search: filters })
    }

    const remove = async (achievementId: string) => {
        if (!confirm('确定删除这个成就吗？')) return
        setPending(true)
        try {
            const result = await adminDeleteAchievementFn({ data: { achievementId } })
            if (!result.success) throw new Error(result.state.message || '删除成就失败')
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除成就失败') }
        finally { setPending(false) }
    }

    return <PageLayout title="成就管理"
            description="选择解锁条件和目标数值，系统会自动发放成就，并为符合条件的老用户补发。"
            action={<Button asChild><Link to="/admin/achievements/create" search={{ page }}><Icon name="plus" />新建成就</Link></Button>}
            scope={{ title: '成就管理范围', items: (['all', 'public', 'hidden'] as const).map(value => ({ key: value, label: value === 'all' ? '全部成就' : value === 'public' ? '公开成就' : '隐藏成就', active: scope === value, onClick: () => go({ scope: value }) })) }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索成就名称或说明",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, conditionType: undefined }),
                groups: [filterGroup('类型', ACHIEVEMENT_CONDITION_TYPE_ARRAY, achievementConditionTypeLabels, conditionType, conditionType => go({ conditionType }))]
            }}>

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        <DataTable label="成就管理表" rows={achievements} rowKey={item => item.id} emptyTitle="暂无成就" columns={[
            { key: 'item', header: '成就', render: item => <div className="flex items-center gap-3">{item.iconUrl && <img src={item.iconUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />}<span className="min-w-0 font-medium">{item.name}</span></div> },
            { key: 'condition', header: '解锁条件', width: '12rem', render: item => <>{achievementConditionTypeLabels[resolveAchievementCondition(item.conditionType, item.code) ?? ''] ?? '请编辑并设置解锁条件'} · {item.conditionValue}</> },
            { key: 'visibility', header: '公开性', width: '8rem', render: item => <VisibilityBadge visible={!item.isHidden} publicLabel="公开成就" hiddenLabel="隐藏成就" /> },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: item => <RowActions><Button size="sm" asChild variant="outline"><Link to="/admin/achievements/$achievementId/edit" params={{ achievementId: item.id }} search={{ page }}>编辑</Link></Button><Button size="sm" variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></RowActions> },
        ]} />
            <Pagination total={total} page={page} size={20} onChange={page => go({ page })} />

    </PageLayout>
}
