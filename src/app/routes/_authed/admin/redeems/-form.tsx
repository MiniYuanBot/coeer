import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { RedeemItem as RecordDefinition } from '~/database/schemas/redeems'
import { Button } from '@/components/coeer'
import { AdminEditorLayout } from '../-editor-layout'
import { Field, Input, Select, Textarea } from '@/components/coeer/ui/Field'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { CreateRedeemItemSchema } from '@shared/contracts/redeems'
import { REDEEM_ITEM_STATUS_ARRAY, REDEEM_ITEM_TYPE_ARRAY, type RedeemItemStatus, type RedeemItemType } from '@shared/constants'
import { redeemItemStatusLabels, redeemItemTypeLabels } from '@/components/coeer'
import { adminCreateRedeemItemFn, adminUpdateRedeemItemFn } from '~/functions'
import { z } from 'zod'

export function RedeemItemForm({ editing, page }: { editing?: RecordDefinition; page: number }) {
    const navigate = useNavigate()
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const finish = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/redeems', search: { page } })
    }

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
            await finish()
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存物品失败，请重试')
        } finally { setPending(false) }
    }

    return <AdminEditorLayout title={editing ? '编辑物品' : '新建物品'} backTo="/admin/redeems" page={page}>
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form onSubmit={submit}>
                    <fieldset disabled={pending} className="grid min-w-0 gap-5">
                        <Field label="名称">
                            <Input name="name" required maxLength={100} defaultValue={editing?.name} placeholder="物品名称" className="h-10" />
                        </Field>
                        <Field label="说明">
                            <Textarea name="description" defaultValue={editing?.description ?? ''} placeholder="物品说明" rows={3} />
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
                            <Button asChild variant="outline"><Link to="/admin/redeems" search={{ page }}>取消</Link></Button>
                            <Button type="submit" loading={pending}>{editing ? '保存物品' : '添加物品'}</Button>
                        </div>
                    </fieldset>
                </form>
    </AdminEditorLayout>
}
