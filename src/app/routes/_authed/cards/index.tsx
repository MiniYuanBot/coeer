import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { CARD_DRAW_COST, CARD_RARITY_ARRAY } from '@shared/constants'
import type { DrawResult } from '@shared/contracts/cards'
import { drawCardsFn, getCardPoolFn, getMyCardsFn } from '~/functions'
import { CollectibleCard } from '@/components/coeer/cards/CollectibleCard'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { Button, EmptyState, Icon, Modal, Pagination, cardRarityLabels, useAsyncAction } from '@/components/coeer'

const searchSchema = z.object({
    scope: z.enum(['all', 'mine']).default('all'),
    rarity: z.enum(CARD_RARITY_ARRAY).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/cards/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 12
        const data = { rarity: search.rarity, search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize }
        if (search.scope === 'mine') {
            const result = await getMyCardsFn({ data })
            if (!result.success) throw new Error(result.state.message)
            return { items: (result.data?.items ?? []).map(item => ({ card: item.card, count: item.count })), total: result.data?.total ?? 0, pageSize }
        }
        const result = await getCardPoolFn({ data })
        if (!result.success) throw new Error(result.state.message)
        return { items: (result.data?.items ?? []).map(card => ({ card, count: card.ownedCount })), total: result.data?.total ?? 0, pageSize }
    },
    component: CardsPage,
})

function CardsPage() {
    const { items, total, pageSize } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { scope, rarity, search, page } = filters
    const navigate = Route.useNavigate()
    const router = useRouter()
    const { loadingKey, run } = useAsyncAction()
    const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
    const draw = async () => {
        const result = await drawCardsFn({ data: { count: 1 } })
        await router.invalidate()
        setDrawResult(result)
    }
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/cards', search: { ...filters, page: 1, ...next } })
    return <PageLayout title="卡片"
            description="收集校园卡片，记录你的收藏。隐藏卡片在获得后显示。"
            action={<Button loading={loadingKey === 'draw'} onClick={() => run('draw', draw, { success: '抽卡完成', error: '抽卡失败' })}><Icon name="card" />抽一张卡 · {CARD_DRAW_COST} 积分</Button>}
            scope={{ title: '卡片范围', items: [{ key: 'all', label: '全部卡片', active: scope === 'all', onClick: () => go({ scope: 'all' }) }, { key: 'mine', label: '我的卡片', active: scope === 'mine', onClick: () => go({ scope: 'mine' }) }] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索卡片名称或系列",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, rarity: undefined }),
                groups: [filterGroup('稀有度', CARD_RARITY_ARRAY, cardRarityLabels, rarity, rarity => go({ rarity }), '全部稀有度')]
            }}>

        {items.length ? <div className="coeer-collection-grid">{items.map(item => <CollectibleCard key={item.card.id} card={item.card} count={item.count} />)}</div>
            : <EmptyState title="没有匹配的卡片" description={scope === 'mine' ? '抽一张校园卡片，开始你的收藏。' : '换个关键词或稀有度试试。'} />}
        <Pagination total={total} page={page} size={pageSize} onChange={page => go({ page })} />
        <Modal open={!!drawResult} title="抽卡结果" onOpenChange={open => { if (!open) setDrawResult(null) }}>
            <p className="mb-4 text-sm text-muted-foreground">本次消耗 {drawResult?.pointsSpent ?? 0} 积分，卡片已加入你的收藏。</p>
            <div className="mx-auto grid max-w-xs gap-4">{drawResult?.cards.map((item, index) => <CollectibleCard key={`${item.cardId}:${index}`} card={item.card} count={item.count} />)}</div>
            <div className="coeer-form-actions mt-4"><Button onClick={() => setDrawResult(null)}>收下卡片</Button></div>
        </Modal>
    </PageLayout>
}
