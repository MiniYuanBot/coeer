import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { CARD_RARITY_ARRAY, type CardRarity } from '@shared/constants/cards'
import { CreateCardSchema } from '@shared/contracts/cards'
import type { Card as CardDefinition } from '~/database/schemas/cards'
import { Button, Card, EmptyState, Pagination, SectionHeader, cardRarityLabels } from '@/components/coeer'
import { Field, Input, Select, Textarea } from '@/components/coeer/ui/Field'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { MediaPreview } from '@/components/coeer/ui/MediaPreview'
import { adminCreateCardFn, adminUpdateCardFn, getCardPoolFn } from '~/functions'

export const Route = createFileRoute('/_authed/admin/cards')({
    validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
    loaderDeps: ({ search }) => search,
    loader: async ({ deps: { page } }) => {
        const result = await getCardPoolFn({ data: { limit: 20, offset: (page - 1) * 20 } })
        return { cards: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminCardsPage,
})

function AdminCardsPage() {
    const { cards, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<CardDefinition | null>(null)
    const [revision, setRevision] = useState(0)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const edit = (card: CardDefinition | null) => { setEditing(card); setError(''); setRevision((value) => value + 1) }

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
                dropRate: Number(form.get('dropRate')),
            })
            const imageUrl = await uploadFormImage(form, 'imageUrl')
            if (!imageUrl) throw new Error('请选择卡面图片，或填写图片地址')
            const data = CreateCardSchema.parse({ ...fields, imageUrl })
            const result = editing ? await adminUpdateCardFn({ data: { cardId: editing.id, ...data } }) : await adminCreateCardFn({ data })
            if (!result.success) throw new Error(result.state.message || '保存卡片失败')
            edit(null)
            await navigate({ to: '/admin/cards', search: { page } })
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存卡片失败，请重试')
        } finally { setPending(false) }
    }

    return <div className="space-y-6">
        <SectionHeader title="卡片管理" description="添加抽卡卡片，设置卡面、稀有度、系列和抽中权重。" />
        <Card className="coeer-admin-form p-5 sm:p-6">
            {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
            <form key={`${editing?.id ?? 'new'}:${revision}`} onSubmit={submit}>
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
                    <ImageUploadField name="imageUrl" label="卡面图片" defaultValue={editing?.imageUrl} preset="card" disabled={pending} />
                    <div className="coeer-form-actions border-t border-border pt-4">
                        {editing ? <Button variant="outline" onClick={() => edit(null)}>取消编辑</Button> : null}
                        <Button type="submit" loading={pending}>{editing ? '保存卡片' : '添加卡片'}</Button>
                    </div>
                </fieldset>
            </form>
        </Card>
        {cards.length ? <Card className="divide-y divide-border">{cards.map((card) => <div key={card.id} className="flex items-center gap-4 p-4">
            <div className="w-12 shrink-0 overflow-hidden rounded-md"><MediaPreview src={card.imageUrl} alt={card.name} preset="card" icon="card" /></div>
            <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-medium">{card.name}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{cardRarityLabels[card.rarity]}{card.series ? ` · ${card.series}` : ''} · 权重 {Number(card.dropRate)} · {Number(card.dropRate) > 0 ? '参与抽取' : '已移出奖池'}</p>
            </div>
            <Button variant="outline" disabled={pending} onClick={() => edit(card)}>编辑</Button>
        </div>)}</Card> : <EmptyState title="暂无卡片" description="添加第一张卡片后，用户即可通过抽卡收集。" />}
        <Pagination total={total} page={page} size={20} onChange={(page) => void navigate({ to: '/admin/cards', search: { page } })} />
    </div>
}
