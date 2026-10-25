import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Button, EmptyState, Icon, Pagination, RedeemItemCard, redeemItemTypeLabels, useAsyncAction } from '@/components/coeer'
import { getMyPointBalanceFn, listRedeemItemsFn, redeemItemFn } from '~/functions'
import { REDEEM_ITEM_TYPE_ARRAY, RedeemItemType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
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
            getMyPointBalanceFn().catch(() => null),
        ])
        return {
            items: itemsResult.data?.items ?? [],
            total: itemsResult.data?.total ?? 0,
            balance: balanceResult?.data?.balance ?? null,
        }
    },
    component: RedeemsPage,
})

function RedeemsPage() {
    const { items, total, balance } = Route.useLoaderData()
    const { type, search, page } = Route.useSearch()
    const navigate = Route.useNavigate()
    const { loadingKey, run } = useAsyncAction()

    const go = (next: { type?: string; search?: string; page?: number }) => {
        navigate({ to: '/redeems', search: previous => ({ ...previous, page: 1, ...next }) })
    }

    return (
        <PageLayout title="积分商城"
            scope={{ title: '商城范围', items: [{ key: 'all', label: '全部物品', active: true, onClick: () => go({ page: 1 }) }] }}
            description="用参与、反馈和贡献积累的积分兑换校园权益与周边。"
            action={<Link to="/profile" className="coeer-focus inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted">
                    <Icon name="coins" className="h-3.5 w-3.5" />{balance === null ? '暂时无法读取积分' : <>可用积分<span className="text-sm font-semibold tabular-nums text-foreground">{balance.toLocaleString('zh-CN')}</span></>}
                </Link>}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索商品名称或说明",
                onSearch: (value) => go({ search: value || undefined }),
                onClear: () => go({ search: undefined, type: undefined }),
                groups: [
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
                ]
            }}>

            {items.length ? (
                <div className="coeer-grid">
                    {items.map((item: any) => (
                        <RedeemItemCard
                            key={item.id}
                            item={item}
                            action={<>
                                <Button
                                    className="w-full"
                                    loading={loadingKey === item.id}
                                    disabled={item.status !== 'active' || item.stock === 0}
                                    onClick={() => run(item.id, () => redeemItemFn({ data: { itemId: item.id, quantity: 1 } }), {
                                        success: '兑换申请已提交',
                                        error: '兑换失败',
                                    })}
                                >
                                    <Icon name="gift" />{item.status !== 'active' || item.stock === 0 ? '暂不可兑换' : balance !== null && balance < item.pointsCost ? '兑换 · 积分不足' : '兑换'}
                                </Button>
                                {item.status === 'active' && item.stock !== 0 && balance !== null && balance < item.pointsCost ? <p className="mt-2 text-xs text-muted-foreground">还需 {item.pointsCost - balance} 积分</p> : null}
                            </>}
                        />
                    ))}
                </div>
            ) : (
                <EmptyState title={search || type ? '没有匹配的商品' : '暂无可兑换商品'} description={search || type ? '试试其他关键词，或清除筛选。' : '新的校园权益和周边上架后会出现在这里。'} action={search || type ? <Button variant="secondary" onClick={() => go({ search: undefined, type: undefined })}>清除筛选</Button> : undefined} />
            )}
            <Pagination total={total} page={page} size={9} onChange={(page) => go({ page })} />
        </PageLayout>
    )
}
