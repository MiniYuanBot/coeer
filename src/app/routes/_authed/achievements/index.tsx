import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY } from '@shared/constants'
import { getAllAchievementsFn, getMyAchievementsFn } from '~/functions'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { AchievementCard, EmptyState, Pagination, achievementConditionTypeLabels } from '@/components/coeer'

const searchSchema = z.object({
    scope: z.enum(['all', 'mine']).default('all'),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/achievements/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 12
        const data = { conditionType: search.conditionType, search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize }
        if (search.scope === 'mine') {
            const result = await getMyAchievementsFn({ data })
            if (!result.success) throw new Error(result.state.message)
            return { achievements: (result.data?.items ?? []).map(item => ({ ...item.achievement, unlocked: true })), total: result.data?.total ?? 0, pageSize }
        }
        const result = await getAllAchievementsFn({ data })
        if (!result.success) throw new Error(result.state.message)
        return { achievements: result.data?.items ?? [], total: result.data?.total ?? 0, pageSize }
    },
    component: AchievementsPage,
})

function AchievementsPage() {
    const { achievements, total, pageSize } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { scope, conditionType, search, page } = filters
    const navigate = Route.useNavigate()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/achievements', search: { ...filters, page: 1, ...next } })
    return <PageLayout title="成就"
            description="解锁贡献成就，记录你的成长。隐藏成就在达成后显示。"
            scope={{ title: '成就范围', items: [{ key: 'all', label: '全部成就', active: scope === 'all', onClick: () => go({ scope: 'all' }) }, { key: 'mine', label: '已达成', active: scope === 'mine', onClick: () => go({ scope: 'mine' }) }] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索成就名称或说明",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, conditionType: undefined }),
                groups: [filterGroup('类型', ACHIEVEMENT_CONDITION_TYPE_ARRAY, achievementConditionTypeLabels, conditionType, conditionType => go({ conditionType }))]
            }}>

        {achievements.length ? <div className="coeer-achievement-grid">{achievements.map(achievement => <AchievementCard key={achievement.id} achievement={achievement} unlocked={achievement.unlocked} />)}</div>
            : <EmptyState title="没有匹配的成就" description="换个关键词或成就类型试试。" />}
        <Pagination total={total} page={page} size={pageSize} onChange={page => go({ page })} />
    </PageLayout>
}
