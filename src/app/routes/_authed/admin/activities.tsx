import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { ACTIVITY_STATUS_ARRAY, ACTIVITY_TYPE_ARRAY, ActivityStatus, ActivityType } from '@shared/constants'
import { Button, Card, EmptyState, SectionHeader, activityStatusLabels, activityTypeLabels } from '@/components/coeer'
import { createActivityFn, deleteActivityFn, getActivityParticipantsFn, listActivitiesFn, updateActivityFn } from '~/functions'

const searchSchema = z.object({ page: z.number().default(1) })

export const Route = createFileRoute('/_authed/admin/activities')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await listActivitiesFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { activities: result.data?.items ?? [] }
    },
    component: AdminActivitiesPage,
})

function AdminActivitiesPage() {
    const { activities } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [participants, setParticipants] = useState<any[] | null>(null)

    const refresh = () => navigate({ to: '/admin/activities', search: { page } })

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const payload = {
            title: form.get('title') as string,
            description: form.get('description') as string,
            type: form.get('type') as ActivityType,
            location: (form.get('location') as string) || undefined,
            startTime: new Date(form.get('startTime') as string),
            endTime: new Date(form.get('endTime') as string),
            maxParticipants: form.get('maxParticipants') ? Number(form.get('maxParticipants')) : undefined,
        }
        if (editing?.id) {
            await updateActivityFn({ data: { id: editing.id, ...payload, status: form.get('status') as ActivityStatus } })
        } else {
            await createActivityFn({ data: payload })
        }
        setEditing(null)
        refresh()
    }

    const remove = async (id: string) => {
        if (!confirm('确定删除这个活动吗？')) return
        await deleteActivityFn({ data: { id } })
        refresh()
    }

    const showParticipants = async (activityId: string) => {
        const result = await getActivityParticipantsFn({ data: { activityId, limit: 100, offset: 0 } })
        setParticipants(result.data?.items ?? [])
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="活动管理" description="发布、编辑、删除活动，并查看报名情况。" />
            <Card className="rounded-xl p-5">
                <form onSubmit={submit} className="grid gap-3">
                    <input name="title" required defaultValue={editing?.title} placeholder="活动标题" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <textarea name="description" required defaultValue={editing?.description} placeholder="活动说明" rows={3} className="coeer-focus resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm leading-6" />
                    <div className="grid gap-3 md:grid-cols-2">
                        <select name="type" defaultValue={editing?.type || 'official'} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                            {ACTIVITY_TYPE_ARRAY.map((type) => <option key={type} value={type}>{activityTypeLabels[type]}</option>)}
                        </select>
                        {editing ? (
                            <select name="status" defaultValue={editing.status} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                                {ACTIVITY_STATUS_ARRAY.map((status) => <option key={status} value={status}>{activityStatusLabels[status]}</option>)}
                            </select>
                        ) : null}
                        <input name="location" defaultValue={editing?.location} placeholder="地点" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <input name="maxParticipants" type="number" min={1} defaultValue={editing?.maxParticipants ?? ''} placeholder="人数上限" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <input name="startTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.startTime)} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                        <input name="endTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.endTime)} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit">{editing ? '保存活动' : '发布活动'}</Button>
                        {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消编辑</Button> : null}
                    </div>
                </form>
            </Card>
            {participants ? (
                <Card className="rounded-xl p-5">
                    <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-medium">报名情况</h2><Button variant="outline" onClick={() => setParticipants(null)}>关闭</Button></div>
                    {participants.length ? participants.map((item) => <p key={item.id} className="py-1 text-sm">{item.user?.name || '未知用户'} · {item.status}</p>) : <p className="text-sm text-[hsl(var(--muted-foreground))]">暂无报名</p>}
                </Card>
            ) : null}
            {activities.length ? (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-xl">
                    {activities.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div><p className="text-[15px] font-medium">{item.title}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{activityTypeLabels[item.type]} · {activityStatusLabels[item.status]}</p></div>
                            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => showParticipants(item.id)}>报名情况</Button><Button variant="outline" onClick={() => setEditing(item)}>编辑</Button><Button variant="danger" onClick={() => remove(item.id)}>删除</Button></div>
                        </div>
                    ))}
                </Card>
            ) : <EmptyState title="暂无活动" />}
        </div>
    )
}

function toDateTimeInput(value?: string | Date | null) {
    if (!value) return ''
    return new Date(value).toISOString().slice(0, 16)
}
