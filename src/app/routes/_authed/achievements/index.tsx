import { Pagination, Modal } from '@/components/coeer'
import { useState } from 'react'
import { CollectibleCard } from '@/components/coeer/cards/CollectibleCard'
import type { DrawResult } from '@shared/contracts/cards'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import {
    AchievementCard,
    Button,
    EmptyState,
    FilterPanel,
    Icon,
    SectionHeader,
    achievementConditionTypeLabels,
    cardRarityLabels,
    useAsyncAction,
} from '@/components/coeer'
import { drawCardsFn, getAllAchievementsFn, getMyCardsFn } from '~/functions'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY, AchievementConditionType, CARD_DRAW_COST, CARD_RARITY_ARRAY, CardRarity } from '@shared/constants'

const searchSchema = z.object({
    view: z.enum(['cards', 'achievements']).default('cards'),
    conditionType: z.string().optional(),
    rarity: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/achievements/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 12
        const pagination = { limit: pageSize, offset: (search.page - 1) * pageSize, search: search.search }
        const allAchievements = search.view === 'achievements'
            ? await getAllAchievementsFn({ data: { ...pagination, conditionType: search.conditionType as AchievementConditionType } })
            : undefined
        const myCards = search.view === 'cards'
            ? await getMyCardsFn({ data: { ...pagination, rarity: search.rarity as CardRarity } })
            : undefined
        return {
            achievements: allAchievements?.data?.items ?? [],
            myCards: myCards?.data?.items ?? [],
            total: (search.view === 'cards' ? myCards : allAchievements)?.data?.total ?? 0,
            pageSize,
        }
    },
    component: AchievementsPage,
})

function AchievementsPage() {
    const { achievements, myCards, total, pageSize } = Route.useLoaderData()
    const { view, conditionType, rarity, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const { loadingKey, run } = useAsyncAction()
    const router = useRouter()
    const [drawResult, setDrawResult] = useState<DrawResult | null>(null)
    const draw = async () => {
        const result = await drawCardsFn({ data: { count: 1 } })
        await router.invalidate()
        setDrawResult(result)
        return result
    }
    const go = (next: { view?: 'cards' | 'achievements'; conditionType?: string; rarity?: string; search?: string; page?: number }) => {
        navigate({ to: '/achievements', search: { view, conditionType, rarity, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="卡片与成就墙"
                description="收集校园卡片，解锁贡献成就，记录你的成长轨迹。"
                action={
                    <Button
                        loading={loadingKey === 'draw'}
                        onClick={() => run('draw', draw, {
                            success: '抽卡完成',
                            error: '抽卡失败',
                        })}
                    >
                        <Icon name="card" /> 抽一张卡 · {CARD_DRAW_COST} 积分
                    </Button>
                }
            />

            <FilterPanel
                searchValue={search}
                searchPlaceholder={view === 'cards' ? '搜索卡片名称、说明或系列' : '搜索成就名称、说明或代码'}
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '查看',
                        items: [
                            { key: 'cards', label: '我的卡片', active: view === 'cards', onClick: () => go({ view: 'cards' }) },
                            { key: 'achievements', label: '成就进度', active: view === 'achievements', onClick: () => go({ view: 'achievements' }) },
                        ],
                    },
                    ...(view === 'achievements' ? [{
                        title: '成就类型',
                        items: [
                            { key: 'all-achievements', label: '全部成就', active: !conditionType, onClick: () => go({ conditionType: undefined }) },
                            ...ACHIEVEMENT_CONDITION_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: achievementConditionTypeLabels[item],
                                active: conditionType === item,
                                onClick: () => go({ conditionType: item as AchievementConditionType, view: 'achievements' }),
                            })),
                        ],
                    }] : []),
                    ...(view === 'cards' ? [{
                        title: '卡片稀有度',
                        items: [
                            { key: 'all-cards', label: '全部卡片', active: !rarity, onClick: () => go({ rarity: undefined }) },
                            ...CARD_RARITY_ARRAY.map((item) => ({
                                key: item,
                                label: cardRarityLabels[item],
                                active: rarity === item,
                                onClick: () => go({ rarity: item as CardRarity, view: 'cards' }),
                            })),
                        ],
                    }] : []),
                ]}
            />

            {view === 'cards' ? (
                <section className="space-y-3">
                    <h2 className="text-[15px] font-medium">我的卡片</h2>
                    {myCards.length ? (
                        <div className="coeer-collection-grid">
                            {myCards.map((item: any) => (
                                <CollectibleCard key={item.id} card={item.card} count={item.count} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="没有匹配的卡片" description="换个关键词或稀有度试试，也可以抽一张卡。" action={<Button loading={loadingKey === 'draw'} onClick={() => run('draw', draw, { success: '抽卡完成', error: '抽卡失败' })}>抽一张卡</Button>} />
                    )}
                </section>
            ) : (
                <section className="space-y-3">
                    <h2 className="text-[15px] font-medium">成就进度</h2>
                    {achievements.length ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {achievements.map((achievement: any) => (
                                <AchievementCard key={achievement.id} achievement={achievement} unlocked={achievement.unlocked} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="没有匹配的成就" description="换个关键词或成就类型试试。" />
                    )}
                </section>
            )}
            <Pagination total={total} page={page} size={pageSize} onChange={(page) => go({ page })} />
            <Modal open={!!drawResult} title="抽卡结果" onOpenChange={(open) => { if (!open) setDrawResult(null) }}>
                <p className="mb-4 text-sm text-muted-foreground">本次消耗 {drawResult?.pointsSpent ?? 0} 积分，卡片已加入你的收藏。</p>
                <div className="mx-auto grid max-w-xs gap-4">{drawResult?.cards.map((item, index) => <CollectibleCard key={`${item.cardId}:${index}`} card={item.card} count={item.count} />)}</div>
                <div className="coeer-form-actions mt-4"><Button onClick={() => setDrawResult(null)}>收下卡片</Button></div>
            </Modal>
        </div>
    )
}
