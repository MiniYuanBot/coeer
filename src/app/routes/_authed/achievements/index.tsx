import { createFileRoute } from '@tanstack/react-router'
import { AchievementCard, Badge, Button, Card, EmptyState, Icon, SectionHeader, useAsyncAction } from '@/components/coeer'
import { drawCardsFn, getAllAchievementsFn, getCardPoolFn, getMyAchievementsFn, getMyCardsFn } from '~/functions'

export const Route = createFileRoute('/_authed/achievements/')({
    loader: async () => {
        const [allAchievements, myAchievements, cards, myCards] = await Promise.allSettled([
            getAllAchievementsFn({ data: { limit: 20, offset: 0 } }),
            getMyAchievementsFn({ data: { limit: 20, offset: 0 } }),
            getCardPoolFn({ data: { limit: 20, offset: 0 } }),
            getMyCardsFn({ data: { limit: 20, offset: 0 } }),
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
    const { loadingKey, run } = useAsyncAction()
    const unlockedIds = new Set(unlocked.map((item: any) => item.achievementId))

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
                <Card className="p-5">
                    <Badge tone="primary">Cards</Badge>
                    <div className="mt-3 text-3xl font-bold">{myCards.length}</div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">已拥有卡片</p>
                </Card>
                <Card className="p-5">
                    <Badge tone="success">Achievements</Badge>
                    <div className="mt-3 text-3xl font-bold">{unlocked.length}</div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">已解锁成就</p>
                </Card>
                <Card className="p-5">
                    <Badge>Pool</Badge>
                    <div className="mt-3 text-3xl font-bold">{cards.length}</div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">卡池卡片</p>
                </Card>
            </div>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">我的卡片</h2>
                {myCards.length ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {myCards.map((item: any) => (
                            <Card key={item.id} className="overflow-hidden">
                                <img src={item.card.imageUrl} alt={item.card.name} className="aspect-square w-full object-cover" />
                                <div className="p-4">
                                    <Badge tone="primary">{item.card.rarity}</Badge>
                                    <h3 className="mt-2 font-semibold">{item.card.name}</h3>
                                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">拥有 {item.count} 张</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <EmptyState title="还没有卡片" description="试试抽卡，或通过活动获得卡片。" />
                )}
            </section>

            <section className="space-y-3">
                <h2 className="text-lg font-semibold">成就进度</h2>
                {achievements.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {achievements.map((achievement: any) => (
                            <AchievementCard key={achievement.id} achievement={achievement} unlocked={unlockedIds.has(achievement.id)} />
                        ))}
                    </div>
                ) : (
                    <EmptyState title="暂无成就" description="成就配置后会在这里展示。" />
                )}
            </section>
        </div>
    )
}
