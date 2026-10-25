import { DataTable, RowActions, PageLayout, StatusBadge, VisibilityBadge } from '@/components/coeer'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { CARD_RARITY_ARRAY } from '@shared/constants'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Icon, Modal, Pagination } from '@/components/coeer'
import { cardRarityLabels } from '@/components/coeer'
import { MediaPreview } from '@/components/coeer/ui/MediaPreview'
import type { Card as CardDefinition } from '~/database/schemas/cards'
import { adminDeleteCardFn, adminListCardsFn } from '~/functions'

const searchSchema = z.object({ scope: z.enum(['all', 'public', 'hidden']).default('all'), rarity: z.enum(CARD_RARITY_ARRAY).optional(), search: z.string().optional(), page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/cards/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const result = await adminListCardsFn({ data: { rarity: search.rarity, isHidden: search.scope === 'all' ? undefined : search.scope === 'hidden', search: search.search, limit: 20, offset: (search.page - 1) * 20 } })
        return { cards: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminCardsPage,
})

function AdminCardsPage() {
    const { cards, total } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { page, scope, rarity, search } = filters
    const navigate = useNavigate()
    const router = useRouter()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/cards', search: { ...filters, page: 1, ...next } })
    const [pending, setPending] = useState(false)
    const [deleting, setDeleting] = useState<CardDefinition | null>(null)
    const [deleteError, setDeleteError] = useState('')

    const remove = async () => {
        if (!deleting || pending) return
        setPending(true)
        setDeleteError('')
        try {
            const result = await adminDeleteCardFn({ data: { cardId: deleting.id } })
            if (!result.success) throw new Error(result.state.message || '删除卡片失败')
            setDeleting(null)
            const nextPage = Math.max(1, Math.min(page, Math.ceil((total - 1) / 20)))
            await navigate({ to: '/admin/cards', search: { ...filters, page: nextPage } })
            await router.invalidate()
        } catch (error) {
            setDeleteError(error instanceof Error ? error.message : '删除卡片失败，请重试')
        } finally { setPending(false) }
    }

    return <PageLayout title="卡片管理"
            description="添加抽卡卡片，设置卡面、稀有度、系列和抽中权重。"
            action={<Button asChild><Link to="/admin/cards/create" search={{ page }}><Icon name="plus" />新建卡片</Link></Button>}
            scope={{ title: '卡片管理范围', items: (['all', 'public', 'hidden'] as const).map(value => ({ key: value, label: value === 'all' ? '全部卡片' : value === 'public' ? '公开卡片' : '隐藏卡片', active: scope === value, onClick: () => go({ scope: value }) })) }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索卡片名称或系列",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, rarity: undefined }),
                groups: [filterGroup('稀有度', CARD_RARITY_ARRAY, cardRarityLabels, rarity, rarity => go({ rarity }), '全部稀有度')]
            }}>

        <DataTable label="卡片管理表" rows={cards} rowKey={card => card.id} emptyTitle="暂无卡片" emptyDescription="添加第一张卡片后，用户即可通过抽卡收集。" columns={[
            { key: 'card', header: '卡片', render: card => <div className="flex items-center gap-3"><div className="w-12 shrink-0 overflow-hidden rounded-md"><MediaPreview src={card.imageUrl} alt={card.name} preset="card" icon="card" /></div><div className="min-w-0"><p className="font-medium">{card.name}</p><p className="mt-1 text-xs text-muted-foreground">{cardRarityLabels[card.rarity]}{card.series ? ` · ${card.series}` : ''} · 权重 {Number(card.dropRate)}</p></div></div> },
            { key: 'visibility', header: '公开性', width: '7rem', render: card => <VisibilityBadge visible={!card.isHidden} publicLabel="公开卡片" hiddenLabel="隐藏卡片" /> },
            { key: 'status', header: '奖池状态', width: '8rem', render: card => <StatusBadge status={Number(card.dropRate) > 0 ? 'active' : 'inactive'} labels={{ active: '参与抽取', inactive: '已移出奖池' }} /> },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: card => <RowActions><Button size="sm" asChild variant="outline"><Link to="/admin/cards/$cardId/edit" params={{ cardId: card.id }} search={{ page }}>编辑</Link></Button><Button size="sm" variant="danger" disabled={pending} onClick={() => { setDeleting(card); setDeleteError('') }}>删除</Button></RowActions> },
        ]} />
        <Pagination total={total} page={page} size={20} onChange={page => go({ page })} />
        <Modal open={!!deleting} title="删除卡片" onOpenChange={open => { if (!open && !pending) setDeleting(null) }}>
            <p>确定删除“{deleting?.name}”吗？删除后无法恢复。</p>
            <p className="mt-2 text-sm text-muted-foreground">已有用户收藏的卡片不能删除，可将抽中权重设为0移出奖池。</p>
            {deleteError ? <p role="alert" className="mt-3 text-sm text-danger">{deleteError}</p> : null}
            <div className="coeer-form-actions mt-4">
                <Button variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>取消</Button>
                <Button variant="danger" loading={pending} onClick={() => void remove()}>确认删除</Button>
            </div>
        </Modal>
    </PageLayout>
}
