import { Field } from '@/components/coeer/ui/Field'
import { EditorSection } from '@/components/coeer/ui/EditorSection'
import { MarkdownEditor } from '@/components/coeer/ui/MarkdownEditor'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { ACTIVITY_STATUS_ARRAY, ACTIVITY_TYPE_ARRAY, ActivityStatus, ActivityType } from '@shared/constants'
import { Button, Card, EmptyState, Pagination, SectionHeader, activityStatusLabels, activityTypeLabels } from '@/components/coeer'
import { createActivityFn, deleteActivityFn, getActivityParticipantsFn, listActivitiesFn, updateActivityFn } from '~/functions'

const searchSchema = z.object({ page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/activities')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await listActivitiesFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { activities: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: AdminActivitiesPage,
})

function AdminActivitiesPage() {
    const { activities, total = 0 } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [error, setError] = useState('')
    const [editorRevision, setEditorRevision] = useState(0)
    const [pending, setPending] = useState(false)
    const [participants, setParticipants] = useState<{ activityId: string; page: number; total: number; items: any[] } | null>(null)

    const refresh = () => navigate({ to: '/admin/activities', search: { page } })

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (pending) return
        setError('')
        const element = e.currentTarget
        const form = new FormData(element)
        const payload = {
            title: form.get('title') as string,
            description: form.get('description') as string,
            type: form.get('type') as ActivityType,
            location: (form.get('location') as string) || undefined,
            startTime: new Date(form.get('startTime') as string),
            endTime: new Date(form.get('endTime') as string),
            maxParticipants: form.get('maxParticipants') ? Number(form.get('maxParticipants')) : undefined,
        }
        setPending(true)
        try {
            const result = editing?.id
                ? await updateActivityFn({ data: { id: editing.id, ...payload, status: form.get('status') as ActivityStatus } })
                : await createActivityFn({ data: payload })
            if (!result.success) throw new Error(result.state.message || '保存活动失败')
            element.reset()
            setEditing(null)
            setEditorRevision(value => value + 1)
            refresh()
        } catch (error) {
            setError(error instanceof Error ? error.message : '保存活动失败，请重试')
        } finally { setPending(false) }
    }

    const remove = async (id: string) => {
        if (!confirm('确定删除这个活动吗？')) return
        await deleteActivityFn({ data: { id } })
        refresh()
    }

    const showParticipants = async (activityId: string, page = 1) => {
        const result = await getActivityParticipantsFn({ data: { activityId, limit: 10, offset: (page - 1) * 10 } })
        setParticipants({ activityId, page, total: result.data?.total ?? 0, items: result.data?.items ?? [] })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="活动管理" description="发布、编辑、删除活动，并查看报名情况。" />
            <EditorSection title={editing ? '编辑活动' : '新建活动'} editKey={editing?.id} attention={!!error} listTitle="全部活动" resetKey={editorRevision} records={<>
            {participants ? (
                <Card className="rounded-lg p-5">
                    <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-medium">报名情况</h2><Button variant="outline" onClick={() => setParticipants(null)}>关闭</Button></div>
                    {participants.items.length ? participants.items.map((item) => <p key={item.id} className="py-1 text-sm">{item.user?.name || '未知用户'} · {item.status}</p>) : <p className="text-sm text-[hsl(var(--muted-foreground))]">暂无报名</p>}
                    <Pagination total={participants.total} page={participants.page} onChange={(page) => void showParticipants(participants.activityId, page)} label="报名名单分页" />
                </Card>
            ) : null}
            {activities.length ? (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-lg">
                    {activities.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div><p className="text-[15px] font-medium">{item.title}</p><p className="text-[13px] text-[hsl(var(--muted-foreground))]">{activityTypeLabels[item.type]} · {activityStatusLabels[item.status]}</p></div>
                            <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => showParticipants(item.id)}>报名情况</Button><Button variant="outline" disabled={pending} onClick={() => { setEditing(item); setError(''); setEditorRevision(value => value + 1) }}>编辑</Button><Button variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button></div>
                        </div>
                    ))}
                </Card>
            ) : <EmptyState title="暂无活动" />}
            <Pagination total={total} page={page} size={20} onChange={(page) => void navigate({ to: '/admin/activities', search: { page } })} />
            </>}>
                {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form key={editing?.id || 'new'} onSubmit={submit} className="grid gap-4">
                    <fieldset disabled={pending} className="grid min-w-0 gap-4">
                    <Field label="标题"><input name="title" required defaultValue={editing?.title} placeholder="活动标题" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    <MarkdownEditor label="说明" name="description" required maxLength={5000} defaultValue={editing?.description} placeholder="活动说明" rows={6} />
                    <div className="grid gap-3 md:grid-cols-2">
                        <Field label="类型"><select name="type" defaultValue={editing?.type || 'official'} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                            {ACTIVITY_TYPE_ARRAY.map((type) => <option key={type} value={type}>{activityTypeLabels[type]}</option>)}
                        </select></Field>
                        {editing ? (
                            <Field label="状态"><select name="status" defaultValue={editing.status} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                                {ACTIVITY_STATUS_ARRAY.map((status) => <option key={status} value={status}>{activityStatusLabels[status]}</option>)}
                            </select></Field>
                        ) : null}
                        <Field label="地点（选填）"><input name="location" defaultValue={editing?.location} placeholder="地点" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="人数上限（选填）"><input name="maxParticipants" type="number" min={1} defaultValue={editing?.maxParticipants ?? ''} placeholder="人数上限" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="开始时间"><input name="startTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.startTime)} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="结束时间"><input name="endTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.endTime)} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" loading={pending}>{editing ? '保存活动' : '发布活动'}</Button>
                        {editing ? <Button type="button" variant="outline" onClick={() => { setEditing(null); setError('') }}>取消编辑</Button> : null}
                    </div>
                    </fieldset>
                </form>
            </EditorSection>
        </div>
    )
}

function toDateTimeInput(value?: string | Date | null) {
    if (!value) return ''
    return new Date(value).toISOString().slice(0, 16)
}
