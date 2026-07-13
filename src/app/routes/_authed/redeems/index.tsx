import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Badge, Button, Card, EmptyState, Icon, PointsSummaryCard, RedeemItemCard, SectionHeader, useAsyncAction } from '@/components/coeer'
import { getMyPointBalanceFn, listRedeemItemsFn, redeemItemFn } from '~/functions'

const searchSchema = z.object({
    type: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/redeems/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const [itemsResult, balanceResult] = await Promise.all([
            listRedeemItemsFn({ data: { type: search.type as any, limit: pageSize, offset: (search.page - 1) * pageSize } }),
            getMyPointBalanceFn(),
        ])
        return {
            items: itemsResult.data?.items ?? [],
            balance: balanceResult.data?.balance ?? 0,
        }
    },
    component: RedeemsPage,
})

function RedeemsPage() {
    const { items, balance } = Route.useLoaderData()
    const { loadingKey, run } = useAsyncAction()

    return (
        <div className="space-y-6">
            <SectionHeader title="积分商城" description="用参与、反馈和贡献积累的积分兑换校园权益与周边。" />
            <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                <aside className="space-y-4">
                    <PointsSummaryCard balance={balance} />
                    <Card className="p-4">
                        <h2 className="font-semibold">筛选</h2>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Badge tone="primary">全部</Badge>
                            <Badge>实体</Badge>
                            <Badge>虚拟</Badge>
                        </div>
                    </Card>
                </aside>
                {items.length ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {items.map((item: any) => (
                            <RedeemItemCard
                                key={item.id}
                                item={item}
                                action={
                                    <Button
                                        className="w-full"
                                        loading={loadingKey === item.id}
                                        disabled={item.status !== 'active' || item.stock === 0}
                                        onClick={() => run(item.id, () => redeemItemFn({ data: { itemId: item.id, quantity: 1 } }), {
                                            success: '兑换申请已提交',
                                            error: '兑换失败',
                                        })}
                                    >
                                        <Icon name="gift" /> 兑换
                                    </Button>
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState title="暂无商品" description="商城商品会在这里展示。" />
                )}
            </div>
        </div>
    )
}
