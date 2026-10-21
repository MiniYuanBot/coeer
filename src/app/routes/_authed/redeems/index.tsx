import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
    Button,
    EmptyState,
    FilterPanel,
    Icon,
    RedeemItemCard,
    SectionHeader,
    redeemItemTypeLabels,
    useAsyncAction,
} from '@/components/coeer'
import { getMyPointBalanceFn, listRedeemItemsFn, redeemItemFn } from '~/functions'
import { REDEEM_ITEM_TYPE_ARRAY, RedeemItemType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/redeems/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const [itemsResult, balanceResult] = await Promise.all([
            listRedeemItemsFn({
                data: {
                    type: search.type as any,
                    search: search.search,
                    limit: pageSize,
                    offset: (search.page - 1) * pageSize,
                },
            }),
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
    const { type, search } = Route.useSearch()
    const navigate = useNavigate()
    const { loadingKey, run } = useAsyncAction()

    const go = (next: { type?: string; search?: string; page?: number }) => {
        navigate({ to: '/redeems', search: { type, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="积分商城" description="用参与、反馈和贡献积累的积分兑换校园权益与周边。"
                action={<Link to="/profile" className="coeer-focus inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted">
                    <Icon name="coins" className="h-3.5 w-3.5" />可用积分<span className="text-sm font-semibold tabular-nums text-foreground">{balance.toLocaleString('zh-CN')}</span>
                </Link>} />

            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索商品名称或说明"
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '类型',
                        items: [
                            { key: 'all', label: '全部商品', active: !type, onClick: () => go({ type: undefined }) },
                            ...REDEEM_ITEM_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: redeemItemTypeLabels[item],
                                active: type === item,
                                onClick: () => go({ type: item as RedeemItemType }),
                            })),
                        ],
                    },
                ]}
            />

            {items.length ? (
                <div className="coeer-grid">
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
                <EmptyState title="暂无商品" description="换个关键词或分类试试。" />
            )}
        </div>
    )
}
