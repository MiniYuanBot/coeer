import { DataTable, RowActions, PageLayout, StatusBadge } from '@/components/coeer'
import { formatDate } from '@/components/coeer'
import { filterGroup } from '@/components/coeer/ui/FilterPanel'
import { REDEEM_ITEM_TYPE_ARRAY } from '@shared/constants'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Icon, Pagination } from '@/components/coeer'
import { redeemItemStatusLabels, redeemItemTypeLabels } from '@/components/coeer'
import { adminDeleteRedeemItemFn, adminListRedeemItemsFn, adminListRedeemOrdersFn } from '~/functions'

const searchSchema = z.object({ scope: z.enum(['all', 'orders']).default('all'), type: z.enum(REDEEM_ITEM_TYPE_ARRAY).optional(), search: z.string().optional(), page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/redeems/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const data = { type: search.type, search: search.search, limit: pageSize, offset: (search.page - 1) * pageSize }
        if (search.scope === 'orders') {
            const result = await adminListRedeemOrdersFn({ data })
            if (!result.success) throw new Error(result.state.message)
            return { items: [], orders: result.data?.items ?? [], total: result.data?.total ?? 0 }
        }
        const result = await adminListRedeemItemsFn({ data })
        if (!result.success) throw new Error(result.state.message)
        return { items: result.data?.items ?? [], orders: [], total: result.data?.total ?? 0 }
    },
    component: AdminRedeemsPage,
})

function AdminRedeemsPage() {
    const { items, orders, total } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { page, scope, type, search } = filters
    const navigate = useNavigate()
    const router = useRouter()
    const go = (next: Partial<typeof filters>) => void navigate({ to: '/admin/redeems', search: { ...filters, page: 1, ...next } })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const refresh = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/redeems', search: filters })
    }

    const remove = async (itemId: string) => {
        if (!confirm('确定删除这个商城物品吗？')) return
        setPending(true)
        try {
            const result = await adminDeleteRedeemItemFn({ data: { itemId } })
            if (!result.success) throw new Error(result.state.message || '删除物品失败')
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除物品失败') }
        finally { setPending(false) }
    }

    return <PageLayout title="商城管理"
            description="添加、编辑、删除商城物品，并查看兑换详情。"
            action={<Button asChild><Link to="/admin/redeems/create" search={{ page }}><Icon name="plus" />新建物品</Link></Button>}
            scope={{ title: '商城管理范围', items: [{ key: 'all', label: '全部物品', active: scope === 'all', onClick: () => go({ scope: 'all' }) }, { key: 'orders', label: '兑换详情', active: scope === 'orders', onClick: () => go({ scope: 'orders' }) }] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索物品名称或说明",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, type: undefined }),
                groups: [filterGroup('类型', REDEEM_ITEM_TYPE_ARRAY, redeemItemTypeLabels, type, type => go({ type }))]
            }}>

        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        {scope === 'orders' ? <DataTable label="兑换详情表" rows={orders} rowKey={order => order.id} emptyTitle="暂无兑换记录" columns={[
            { key: 'item', header: '物品', render: order => <><p className="font-medium">{order.item.name}</p>{order.redeemCode && <p className="mt-1 text-xs text-muted-foreground">兑换码：{order.redeemCode}</p>}</> },
            { key: 'user', header: '兑换人', width: '8rem', render: order => order.user?.name || '未知用户' },
            { key: 'quantity', header: '数量', width: '5rem', render: order => order.quantity },
            { key: 'status', header: '状态', width: '7rem', render: order => <StatusBadge status={order.status} labels={{ pending: '待处理', completed: '已完成', cancelled: '已取消' }} /> },
            { key: 'time', header: '时间', width: '7rem', render: order => formatDate(order.createdAt) },
        ]} /> : <DataTable label="商城管理表" rows={items} rowKey={item => item.id} emptyTitle="暂无商城物品" columns={[
            { key: 'item', header: '物品', render: item => <div className="flex items-center gap-3">{item.imageUrl && <img src={item.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-contain" />}<span className="min-w-0 font-medium">{item.name}</span></div> },
            { key: 'type', header: '类型', width: '8rem', render: item => redeemItemTypeLabels[item.type] },
            { key: 'status', header: '状态', width: '7rem', render: item => <StatusBadge status={item.status} labels={redeemItemStatusLabels} /> },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: item => <RowActions><Button size="sm" asChild variant="outline"><Link to="/admin/redeems/$itemId/edit" params={{ itemId: item.id }} search={{ page }}>编辑</Link></Button><Button size="sm" variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></RowActions> },
        ]} />}
            <Pagination total={total} page={page} size={20} onChange={page => go({ page })} />

    </PageLayout>
}
