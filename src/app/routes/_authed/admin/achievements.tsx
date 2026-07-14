import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY, AchievementConditionType } from '@shared/constants'
import { Button, Card, EmptyState, SectionHeader, achievementConditionTypeLabels } from '@/components/coeer'
import { adminCreateAchievementFn, adminDeleteAchievementFn, adminUpdateAchievementFn, getAllAchievementsFn } from '~/functions'

const searchSchema = z.object({ page: z.number().default(1) })

export const Route = createFileRoute('/_authed/admin/achievements')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await getAllAchievementsFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { achievements: result.data?.items ?? [] }
    },
    component: AdminAchievementsPage,
})

function AdminAchievementsPage() {
    const { achievements } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const refresh = () => navigate({ to: '/admin/achievements', search: { page } })

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const payload = {
            code: form.get('code') as string,
            name: form.get('name') as string,
            description: form.get('description') as string,
            iconUrl: (form.get('iconUrl') as string) || undefined,
            conditionType: form.get('conditionType') as AchievementConditionType,
            conditionValue: Number(form.get('conditionValue')),
        }
        if (editing?.id) await adminUpdateAchievementFn({ data: { achievementId: editing.id, ...payload } })
        else await adminCreateAchievementFn({ data: payload })
        setEditing(null)
        refresh()
    }

    const remove = async (achievementId: string) => {
        if (!confirm('确定删除这个成就吗？')) return
        await adminDeleteAchievementFn({ data: { achievementId } })
        refresh()
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="成就管理" description="添加、编辑和删除成就。" />
            <Card className="rounded-xl p-5">
                <form onSubmit={submit} className="grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                        <input name="code" required defaultValue={editing?.code} placeholder="成就代码" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <input name="name" required defaultValue={editing?.name} placeholder="成就名称" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <select name="conditionType" defaultValue={editing?.conditionType || 'count'} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">{ACHIEVEMENT_CONDITION_TYPE_ARRAY.map((type) => <option key={type} value={type}>{achievementConditionTypeLabels[type]}</option>)}</select>
                        <input name="conditionValue" required type="number" min={1} defaultValue={editing?.conditionValue} placeholder="达成数值" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </div>
                    <input name="iconUrl" defaultValue={editing?.iconUrl} placeholder="图标 URL" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <textarea name="description" required defaultValue={editing?.description} placeholder="成就说明" rows={3} className="coeer-focus resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm leading-6" />
                    <div className="flex gap-2"><Button type="submit">{editing ? '保存成就' : '添加成就'}</Button>{editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消编辑</Button> : null}</div>
                </form>
            </Card>
            {achievements.length ? <Card className="divide-y divide-[hsl(var(--border))] rounded-xl">{achievements.map((item: any) => <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between"><div><p className="text-[15px] font-medium">{item.name}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{achievementConditionTypeLabels[item.conditionType]} · {item.conditionValue}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setEditing(item)}>编辑</Button><Button variant="danger" onClick={() => remove(item.id)}>删除</Button></div></div>)}</Card> : <EmptyState title="暂无成就" />}
        </div>
    )
}
