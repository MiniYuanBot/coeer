import { Field, Input, Select, Textarea } from '@/components/coeer/ui/Field'
import { EditorSection } from '@/components/coeer/ui/EditorSection'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { CreateRedeemItemSchema } from '@shared/contracts/redeems'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { REDEEM_ITEM_STATUS_ARRAY, REDEEM_ITEM_TYPE_ARRAY, RedeemItemStatus, RedeemItemType } from '@shared/constants'
import { Button, Card, EmptyState, Pagination, SectionHeader, redeemItemStatusLabels, redeemItemTypeLabels } from '@/components/coeer'
import { adminCreateRedeemItemFn, adminDeleteRedeemItemFn, adminListRedeemItemsFn, adminListRedeemOrdersFn, adminUpdateRedeemItemFn } from '~/functions'

const searchSchema = z.object({ page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/redeems')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await adminListRedeemItemsFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { items: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminRedeemsPage,
})

function AdminRedeemsPage() {
    const { items, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [editorRevision, setEditorRevision] = useState(0)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    const [orders, setOrders] = useState<{ itemId: string; page: number; total: number; items: any[] } | null>(null)
    const refresh = () => navigate({ to: '/admin/redeems', search: { page } })
    const edit = (item: any | null) => { setEditing(item); setError(''); setRevision((value) => value + 1); setEditorRevision(value => value + 1) }

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (pending) return
        setError('')
        const form = new FormData(e.currentTarget)
        const payload = {
            name: form.get('name') as string,
            description: (form.get('description') as string) || undefined,
            imageUrl: null,
            pointsCost: Number(form.get('pointsCost')),
            stock: Number(form.get('stock')),
            type: form.get('type') as RedeemItemType,
            status: form.get('status') as RedeemItemStatus,
        }
        setPending(true)
        try {
            const data = CreateRedeemItemSchema.parse({ ...payload, imageUrl: await uploadFormImage(form, 'imageUrl') })
            const result = editing?.id ? await adminUpdateRedeemItemFn({ data: { itemId: editing.id, ...data } })
                : await adminCreateRedeemItemFn({ data })
            if (!result.success) throw new Error(result.state.message || '保存物品失败')
            edit(null)
            setEditorRevision(value => value + 1)
            await refresh()
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存物品失败，请重试')
        } finally { setPending(false) }
    }

    const remove = async (itemId: string) => {
        if (!confirm('确定删除这个商城物品吗？')) return
        setPending(true)
        try {
            const result = await adminDeleteRedeemItemFn({ data: { itemId } })
            if (!result.success) throw new Error(result.state.message || '删除物品失败')
            if (editing?.id === itemId) edit(null)
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除物品失败') }
        finally { setPending(false) }
    }

    const showOrders = async (itemId: string, page = 1) => {
        const result = await adminListRedeemOrdersFn({ data: { itemId, limit: 10, offset: (page - 1) * 10 } })
        setOrders({ itemId, page, total: result.data?.total ?? 0, items: result.data?.items ?? [] })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="商城管理" description="添加、编辑、删除商城物品，并查看兑换详情。" />
            <EditorSection title={editing ? '编辑物品' : '新建物品'} editKey={editing?.id} attention={!!error} listTitle="全部商品" resetKey={editorRevision} records={<>
            {orders ? <Card className="rounded-lg p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-medium">兑换详情</h2><Button variant="outline" onClick={() => setOrders(null)}>关闭</Button></div>{orders.items.length ? orders.items.map((order) => <p key={order.id} className="py-1 text-sm">{order.user?.name || '未知用户'} · {order.status}</p>) : <p className="text-sm text-[hsl(var(--muted-foreground))]">暂无兑换</p>}<Pagination total={orders.total} page={orders.page} onChange={(page) => void showOrders(orders.itemId, page)} label="兑换订单分页" /></Card> : null}
            {items.length ? <Card className="divide-y divide-[hsl(var(--border))] rounded-lg">{items.map((item: any) => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3">{item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-12 w-12 rounded-lg object-contain" /> : null}<div><p className="text-[15px] font-medium">{item.name}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{redeemItemTypeLabels[item.type]} · {redeemItemStatusLabels[item.status]}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => showOrders(item.id)}>兑换详情</Button><Button variant="outline" disabled={pending} onClick={() => edit(item)}>编辑</Button><Button variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></div></div>)}</Card> : <EmptyState title="暂无商城物品" />}
            <Pagination total={total} page={page} size={20} onChange={(page) => void navigate({ to: '/admin/redeems', search: { page } })} />
            </>}>
                {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form key={`${editing?.id || 'new'}:${revision}`} onSubmit={submit}>
                    <fieldset disabled={pending} className="grid min-w-0 gap-5">
                        <Field label="名称">
                            <Input name="name" required maxLength={100} defaultValue={editing?.name} placeholder="物品名称" className="h-10" />
                        </Field>
                        <Field label="说明">
                            <Textarea name="description" defaultValue={editing?.description} placeholder="物品说明" rows={3} />
                        </Field>
                        <div className="coeer-admin-form-grid">
                            <Field label="所需积分">
                                <Input name="pointsCost" required type="number" min={1} defaultValue={editing?.pointsCost} placeholder="积分价格" className="h-10" />
                            </Field>
                            <Field label="库存" description="填 −1 表示不限库存。">
                                <Input name="stock" required type="number" min={-1} defaultValue={editing?.stock ?? -1} placeholder="库存" className="h-10" />
                            </Field>
                            <Field label="类型">
                                <Select name="type" defaultValue={editing?.type || 'physical'} className="h-10">
                                    {REDEEM_ITEM_TYPE_ARRAY.map((type) => <option key={type} value={type}>{redeemItemTypeLabels[type]}</option>)}
                                </Select>
                            </Field>
                            <Field label="状态">
                                <Select name="status" defaultValue={editing?.status || 'active'} className="h-10">
                                    {REDEEM_ITEM_STATUS_ARRAY.map((status) => <option key={status} value={status}>{redeemItemStatusLabels[status]}</option>)}
                                </Select>
                            </Field>
                        </div>
                        <ImageUploadField name="imageUrl" label="商品图片（选填）" defaultValue={editing?.imageUrl} disabled={pending} preset="redeem" />
                        <div className="coeer-form-actions border-t border-border pt-4">
                            {editing ? <Button variant="outline" onClick={() => edit(null)}>取消编辑</Button> : null}
                            <Button type="submit" loading={pending}>{editing ? '保存物品' : '添加物品'}</Button>
                        </div>
                    </fieldset>
                </form>
            </EditorSection>
        </div>
    )
}
