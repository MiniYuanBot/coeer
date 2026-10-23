import { Field } from '@/components/coeer/ui/Field'
import { ImageUploadField, uploadFormImage } from '@/components/coeer/ui/ImageUploadField'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { CONFIGURABLE_ACHIEVEMENT_CONDITIONS, resolveAchievementCondition, type ConfigurableAchievementCondition } from '@shared/constants'
import { CreateAchievementSchema } from '@shared/contracts/achievements'
import { Button, Card, EmptyState, Pagination, SectionHeader, achievementConditionTypeLabels } from '@/components/coeer'
import { adminCreateAchievementFn, adminDeleteAchievementFn, adminUpdateAchievementFn, getAllAchievementsFn } from '~/functions'

const searchSchema = z.object({ page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/achievements')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await getAllAchievementsFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { achievements: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminAchievementsPage,
})

function AdminAchievementsPage() {
    const { achievements, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [condition, setCondition] = useState<ConfigurableAchievementCondition>('registration')
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    const refresh = () => navigate({ to: '/admin/achievements', search: { page } })
    const edit = (item: any | null) => {
        setEditing(item)
        setCondition(item ? resolveAchievementCondition(item.conditionType, item.code) ?? 'registration' : 'registration')
        setError('')
        setRevision((value) => value + 1)
    }

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (pending) return
        setError('')
        const form = new FormData(e.currentTarget)
        const payload = {
            code: (form.get('code') as string).trim() || `ACH_${crypto.randomUUID().replaceAll('-', '')}`,
            name: form.get('name') as string,
            description: form.get('description') as string,
            iconUrl: null,
            conditionType: condition,
            conditionValue: Number(form.get('conditionValue')),
        }
        setPending(true)
        try {
            const data = CreateAchievementSchema.parse({ ...payload, iconUrl: await uploadFormImage(form, 'iconUrl') })
            const result = editing?.id ? await adminUpdateAchievementFn({ data: { achievementId: editing.id, ...data } })
                : await adminCreateAchievementFn({ data })
            if (!result.success) throw new Error(result.state.message || '保存成就失败')
            edit(null)
            await refresh()
        } catch (error) {
            setError(error instanceof z.ZodError ? error.issues[0].message : error instanceof Error ? error.message : '保存成就失败，请重试')
        } finally { setPending(false) }
    }

    const remove = async (achievementId: string) => {
        if (!confirm('确定删除这个成就吗？')) return
        setPending(true)
        try {
            const result = await adminDeleteAchievementFn({ data: { achievementId } })
            if (!result.success) throw new Error(result.state.message || '删除成就失败')
            if (editing?.id === achievementId) edit(null)
            await refresh()
        } catch (error) { setError(error instanceof Error ? error.message : '删除成就失败') }
        finally { setPending(false) }
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="成就管理" description="选择解锁条件和目标数值，系统会自动发放成就，并为符合条件的老用户补发。" />
            <Card className="rounded-lg p-5">
                {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form key={`${editing?.id || 'new'}:${revision}`} onSubmit={submit}>
                <fieldset disabled={pending} className="grid min-w-0 gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="成就代码（选填）"><input name="code" maxLength={50} defaultValue={editing?.code} placeholder="留空自动生成，无需用代码编写规则" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="名称"><input name="name" required defaultValue={editing?.name} placeholder="成就名称" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="解锁条件" description={conditionDescriptions[condition]}><select name="conditionType" value={condition} onChange={(event) => setCondition(event.target.value as ConfigurableAchievementCondition)} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">{CONFIGURABLE_ACHIEVEMENT_CONDITIONS.map((type) => <option key={type} value={type}>{achievementConditionTypeLabels[type]}</option>)}</select></Field>
                        <Field label={condition === 'login_days' ? '目标天数' : condition === 'points_earned' ? '目标积分' : '目标数值'}><input key={condition} name="conditionValue" required type="number" min={1} max={2147483647} step={1} readOnly={condition === 'registration'} defaultValue={condition === 'registration' ? 1 : editing && resolveAchievementCondition(editing.conditionType, editing.code) === condition ? editing.conditionValue : condition === 'login_days' ? 100 : condition === 'points_earned' ? 10000 : 1} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    </div>
                    <ImageUploadField name="iconUrl" label="成就图标（选填）" defaultValue={editing?.iconUrl} />
                    <Field label="说明"><textarea name="description" required defaultValue={editing?.description} placeholder="成就说明" rows={3} className="coeer-focus resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm leading-6" /></Field>
                    <div className="flex gap-2"><Button type="submit" loading={pending}>{editing ? '保存成就' : '添加成就'}</Button>{editing ? <Button type="button" variant="outline" onClick={() => edit(null)}>取消编辑</Button> : null}</div>
                </fieldset>
                </form>
            </Card>
            {achievements.length ? <Card className="divide-y divide-[hsl(var(--border))] rounded-lg">{achievements.map((item: any) => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div className="flex items-center gap-3">{item.iconUrl ? <img src={item.iconUrl} alt={item.name} className="h-12 w-12 rounded-lg object-contain" /> : null}<div><p className="text-[15px] font-medium">{item.name}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{achievementConditionTypeLabels[resolveAchievementCondition(item.conditionType, item.code) ?? ''] ?? '请编辑并设置解锁条件'} · {item.conditionValue}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={pending} onClick={() => edit(item)}>编辑</Button><Button variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></div></div>)}</Card> : <EmptyState title="暂无成就" />}
            <Pagination total={total} page={page} size={20} onChange={(page) => void navigate({ to: '/admin/achievements', search: { page } })} />
        </div>
    )
}

const conditionDescriptions: Record<ConfigurableAchievementCondition, string> = {
    registration: '成功注册后自动获得，已有账号也可获得。',
    login_days: '按北京时间统计登录或访问的不同日期，同一天多次登录只计 1 天，无需连续登录。',
    points_earned: '累计历史获得的积分，兑换或抽卡消耗不会减少进度。',
    feedback_count: '按用户提交的反馈总数统计。',
    group_count: '统计用户创建或以管理员身份管理的群组，不含已驳回群组。',
    card_count: '按拥有的不同卡片种类统计，重复卡片不重复计数。',
}
