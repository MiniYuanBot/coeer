import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
    AchievementCard,
    Badge,
    Button,
    Card,
    EmptyState,
    FilterPanel,
    Icon,
    SectionHeader,
    achievementConditionTypeLabels,
    cardRarityLabels,
    useAsyncAction,
} from '@/components/coeer'
import { drawCardsFn, getAllAchievementsFn, getCardPoolFn, getMyAchievementsFn, getMyCardsFn } from '~/functions'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY, AchievementConditionType, CARD_RARITY_ARRAY, CardRarity } from '@shared/constants'

const searchSchema = z.object({
    view: z.enum(['cards', 'achievements']).default('cards'),
    conditionType: z.string().optional(),
    rarity: z.string().optional(),
    search: z.string().optional(),
})

export const Route = createFileRoute('/_authed/achievements/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const [allAchievements, myAchievements, cards, myCards] = await Promise.allSettled([
            getAllAchievementsFn({
                data: {
                    conditionType: search.conditionType as any,
                    search: search.search,
                    limit: 100,
                    offset: 0,
                },
            }),
            getMyAchievementsFn({ data: { limit: 100, offset: 0 } }),
            getCardPoolFn({ data: { rarity: search.rarity as any, limit: 100, offset: 0 } }),
            getMyCardsFn({ data: { limit: 100, offset: 0 } }),
        ])

        return {
            achievements: allAchievements.status === 'fulfilled' ? allAchievements.value.data?.items ?? [] : [],
            unlocked: myAchievements.status === 'fulfilled' ? myAchievements.value.data?.items ?? [] : [],
            cards: cards.status === 'fulfilled' ? cards.value.data?.items ?? [] : [],
            myCards: myCards.status === 'fulfilled' ? myCards.value.data?.items ?? [] : [],
        }
    },
    component: AchievementsPage,
})

function AchievementsPage() {
    const { achievements, unlocked, cards, myCards } = Route.useLoaderData()
    const { view, conditionType, rarity, search } = Route.useSearch()
    const navigate = useNavigate()
    const { loadingKey, run } = useAsyncAction()
    const unlockedIds = new Set(unlocked.map((item: any) => item.achievementId))
    const keyword = search?.trim().toLowerCase()
    const visibleMyCards = myCards.filter((item: any) => {
        const card = item.card
        const matchesRarity = !rarity || card.rarity === rarity
        const matchesSearch = !keyword ||
            card.name.toLowerCase().includes(keyword) ||
            card.description?.toLowerCase().includes(keyword) ||
            card.series?.toLowerCase().includes(keyword)
        return matchesRarity && matchesSearch
    })

    const go = (next: { view?: 'cards' | 'achievements'; conditionType?: string; rarity?: string; search?: string }) => {
        navigate({ to: '/achievements', search: { view, conditionType, rarity, search, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="卡片与成就墙"
                description="收集校园卡片，解锁贡献成就，记录你的成长轨迹。"
                action={
                    <Button
                        loading={loadingKey === 'draw'}
                        onClick={() => run('draw', () => drawCardsFn({ data: { count: 1 } }), {
                            success: '抽卡完成',
                            error: '抽卡失败',
                        })}
                    >
                        <Icon name="card" /> 抽一张卡
                    </Button>
                }
            />

            <div className="grid gap-4 md:grid-cols-3">
                <Card className="rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                            <Icon name="card" />
                        </div>
                        <div>
                            <div className="text-2xl font-medium tabular-nums">{myCards.length}</div>
                            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">我的卡片</p>
                        </div>
                    </div>
                </Card>
                <Card className="rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <Icon name="award" />
                        </div>
                        <div>
                            <div className="text-2xl font-medium tabular-nums">{unlocked.length}</div>
                            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">已解锁成就</p>
                        </div>
                    </div>
                </Card>
                <Card className="rounded-xl p-5">
                    <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]">
                            <Icon name="spark" />
                        </div>
                        <div>
                            <div className="text-2xl font-medium tabular-nums">{cards.length}</div>
                            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">卡池</p>
                        </div>
                    </div>
                </Card>
            </div>

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
                    {
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
                    },
                    {
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
                    },
                ]}
            />

            {view === 'cards' ? (
                <section className="space-y-3">
                    <h2 className="text-[15px] font-medium">我的卡片</h2>
                    {visibleMyCards.length ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleMyCards.map((item: any) => (
                                <Card key={item.id} className="overflow-hidden rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                                    <img src={item.card.imageUrl} alt={item.card.name} className="aspect-square w-full object-cover" />
                                    <div className="p-4">
                                        <Badge tone="primary">{cardRarityLabels[item.card.rarity] || item.card.rarity}</Badge>
                                        <h3 className="mt-2 text-[15px] font-medium">{item.card.name}</h3>
                                        <p className="mt-1 text-[13px] text-[hsl(var(--muted-foreground))]">拥有 {item.count} 张</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="没有匹配的卡片" description="换个关键词或稀有度试试，也可以抽一张卡。" action={<Button onClick={() => run('draw', () => drawCardsFn({ data: { count: 1 } }), { success: '抽卡完成', error: '抽卡失败' })}>抽一张卡</Button>} />
                    )}
                </section>
            ) : (
                <section className="space-y-3">
                    <h2 className="text-[15px] font-medium">成就进度</h2>
                    {achievements.length ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {achievements.map((achievement: any) => (
                                <AchievementCard key={achievement.id} achievement={achievement} unlocked={unlockedIds.has(achievement.id)} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState title="没有匹配的成就" description="换个关键词或成就类型试试。" />
                    )}
                </section>
            )}
        </div>
    )
}
