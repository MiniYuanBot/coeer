import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { Card as RecordDefinition } from '~/database/schemas/cards'
import { Button } from '@/components/coeer'
import { AdminEditorLayout } from '../-editor-layout'
import { Field, Input, Select, Textarea } from '@/components/coeer/ui/Field'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { CARD_RARITY_ARRAY, type CardRarity } from '@shared/constants/cards'
import { CreateCardSchema } from '@shared/contracts/cards'
import { cardRarityLabels } from '@/components/coeer'
import { adminCreateCardFn, adminUpdateCardFn } from '~/functions'
import { z } from 'zod'

export function CardForm({ editing, page }: { editing?: RecordDefinition; page: number }) {
    const navigate = useNavigate()
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const finish = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/cards', search: { page } })
    }

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (pending) return
        const form = new FormData(event.currentTarget)
        setPending(true)
        setError('')
        try {
            const fields = CreateCardSchema.omit({ imageUrl: true }).parse({
                name: String(form.get('name') ?? ''), description: String(form.get('description') ?? ''),
                series: String(form.get('series') ?? ''), rarity: form.get('rarity') as CardRarity,
                isHidden: form.get('isHidden') === 'hidden',
                dropRate: Number(form.get('dropRate')),
            })
            const imageUrl = await uploadFormImage(form, 'imageUrl')
            if (!imageUrl) throw new Error('请选择卡面图片，或填写图片地址')
            const data = CreateCardSchema.parse({ ...fields, imageUrl })
            const result = editing ? await adminUpdateCardFn({ data: { cardId: editing.id, ...data } }) : await adminCreateCardFn({ data })
            if (!result.success) throw new Error(result.state.message || '保存卡片失败')
            await finish()
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存卡片失败，请重试')
        } finally { setPending(false) }
    }

    return <AdminEditorLayout title={editing ? '编辑卡片' : '新建卡片'} backTo="/admin/cards" page={page}>
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
            <form onSubmit={submit}>
                <fieldset disabled={pending} className="grid min-w-0 gap-5">
                    <div className="coeer-admin-form-grid">
                        <Field label="名称"><Input name="name" required maxLength={100} defaultValue={editing?.name} placeholder="卡片名称" className="h-10" /></Field>
                        <Field label="系列（选填）"><Input name="series" maxLength={100} defaultValue={editing?.series ?? ''} placeholder="例如：校园四季" className="h-10" /></Field>
                        <Field label="稀有度"><Select name="rarity" defaultValue={editing?.rarity ?? 'common'} className="h-10">
                            {CARD_RARITY_ARRAY.map((rarity) => <option key={rarity} value={rarity}>{cardRarityLabels[rarity]}</option>)}
                        </Select></Field>
                        <Field label="抽中权重" description="范围 0–1，最多四位小数。0 表示移出奖池，已拥有的卡片保留。">
                            <Input name="dropRate" type="number" required min={0} max={1} step={.0001} defaultValue={editing ? Number(editing.dropRate) : .1} className="h-10" />
                        </Field>
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">实际抽中概率按奖池中的权重占比计算。例如三张卡的权重为 0.6、0.3、0.1 时，抽中概率分别为 60%、30%、10%。</p>
                    <Field label="说明（选填）"><Textarea name="description" maxLength={5000} rows={3} defaultValue={editing?.description ?? ''} placeholder="卡片故事或收集说明" /></Field>
                    <Field label="可见性" description="隐藏卡片仅在获得后向该用户显示。"><Select name="isHidden" defaultValue={editing?.isHidden ? 'hidden' : 'public'}><option value="public">公开卡片</option><option value="hidden">隐藏卡片</option></Select></Field>
                    <ImageUploadField name="imageUrl" label="卡面图片" defaultValue={editing?.imageUrl} preset="card" disabled={pending} />
                    <div className="coeer-form-actions border-t border-border pt-4">
                        <Button asChild variant="outline"><Link to="/admin/cards" search={{ page }}>取消</Link></Button>
                        <Button type="submit" loading={pending}>{editing ? '保存卡片' : '添加卡片'}</Button>
                    </div>
                </fieldset>
            </form>
    </AdminEditorLayout>
}
