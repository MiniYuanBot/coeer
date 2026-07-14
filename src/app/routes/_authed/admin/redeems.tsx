import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { REDEEM_ITEM_STATUS_ARRAY, REDEEM_ITEM_TYPE_ARRAY, RedeemItemStatus, RedeemItemType } from '@shared/constants'
import { Button, Card, EmptyState, SectionHeader, redeemItemStatusLabels, redeemItemTypeLabels } from '@/components/coeer'
import { adminCreateRedeemItemFn, adminDeleteRedeemItemFn, adminListRedeemOrdersFn, adminUpdateRedeemItemFn, listRedeemItemsFn } from '~/functions'

const searchSchema = z.object({ page: z.number().default(1) })

export const Route = createFileRoute('/_authed/admin/redeems')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await listRedeemItemsFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { items: result.data?.items ?? [] }
    },
    component: AdminRedeemsPage,
})

function AdminRedeemsPage() {
    const { items } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [orders, setOrders] = useState<any[] | null>(null)
    const refresh = () => navigate({ to: '/admin/redeems', search: { page } })

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const payload = {
            name: form.get('name') as string,
            description: (form.get('description') as string) || undefined,
            imageUrl: (form.get('imageUrl') as string) || undefined,
            pointsCost: Number(form.get('pointsCost')),
            stock: Number(form.get('stock')),
            type: form.get('type') as RedeemItemType,
            status: form.get('status') as RedeemItemStatus,
        }
        if (editing?.id) await adminUpdateRedeemItemFn({ data: { itemId: editing.id, ...payload } })
        else await adminCreateRedeemItemFn({ data: payload })
        setEditing(null)
        refresh()
    }

    const remove = async (itemId: string) => {
        if (!confirm('确定删除这个商城物品吗？')) return
        await adminDeleteRedeemItemFn({ data: { itemId } })
        refresh()
    }

    const showOrders = async (itemId: string) => {
        const result = await adminListRedeemOrdersFn({ data: { itemId, limit: 100, offset: 0 } })
        setOrders(result.data?.items ?? [])
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="商城管理" description="添加、编辑、删除商城物品，并查看兑换详情。" />
            <Card className="rounded-xl p-5">
                <form onSubmit={submit} className="grid gap-3">
                    <input name="name" required defaultValue={editing?.name} placeholder="物品名称" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <textarea name="description" defaultValue={editing?.description} placeholder="物品说明" rows={3} className="coeer-focus resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm leading-6" />
                    <input name="imageUrl" defaultValue={editing?.imageUrl} placeholder="图片 URL" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <div className="grid gap-3 md:grid-cols-2">
                        <input name="pointsCost" required type="number" min={1} defaultValue={editing?.pointsCost} placeholder="积分价格" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <input name="stock" required type="number" min={-1} defaultValue={editing?.stock ?? -1} placeholder="库存" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <select name="type" defaultValue={editing?.type || 'physical'} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">{REDEEM_ITEM_TYPE_ARRAY.map((type) => <option key={type} value={type}>{redeemItemTypeLabels[type]}</option>)}</select>
                        <select name="status" defaultValue={editing?.status || 'active'} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">{REDEEM_ITEM_STATUS_ARRAY.map((status) => <option key={status} value={status}>{redeemItemStatusLabels[status]}</option>)}</select>
                    </div>
                    <div className="flex gap-2"><Button type="submit">{editing ? '保存物品' : '添加物品'}</Button>{editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消编辑</Button> : null}</div>
                </form>
            </Card>
            {orders ? <Card className="rounded-xl p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-medium">兑换详情</h2><Button variant="outline" onClick={() => setOrders(null)}>关闭</Button></div>{orders.length ? orders.map((order) => <p key={order.id} className="py-1 text-sm">{order.user?.name || '未知用户'} · {order.status}</p>) : <p className="text-sm text-[hsl(var(--muted-foreground))]">暂无兑换</p>}</Card> : null}
            {items.length ? <Card className="divide-y divide-[hsl(var(--border))] rounded-xl">{items.map((item: any) => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="text-[15px] font-medium">{item.name}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{redeemItemTypeLabels[item.type]} · {redeemItemStatusLabels[item.status]}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => showOrders(item.id)}>兑换详情</Button><Button variant="outline" onClick={() => setEditing(item)}>编辑</Button><Button variant="danger" onClick={() => remove(item.id)}>删除</Button></div></div>)}</Card> : <EmptyState title="暂无商城物品" />}
        </div>
    )
}
