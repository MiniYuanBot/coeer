import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { Activity as RecordDefinition } from '~/database/schemas/activities'
import { Button } from '@/components/coeer'
import { AdminEditorLayout } from '../-editor-layout'
import { Field } from '@/components/coeer/ui/Field'
import { MarkdownEditor } from '@/components/coeer/ui/MarkdownEditor'
import { ACTIVITY_STATUS_ARRAY, ACTIVITY_TYPE_ARRAY, type ActivityStatus, type ActivityType } from '@shared/constants'
import { activityStatusLabels, activityTypeLabels } from '@/components/coeer'
import { createActivityFn, updateActivityFn } from '~/functions'

export function ActivityForm({ editing, page }: { editing?: RecordDefinition; page: number }) {
    const navigate = useNavigate()
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const finish = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/activities', search: { page } })
    }

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
            await finish()
        } catch (error) {
            setError(error instanceof Error ? error.message : '保存活动失败，请重试')
        } finally { setPending(false) }
    }

    return <AdminEditorLayout title={editing ? '编辑活动' : '新建活动'} backTo="/admin/activities" page={page}>
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form onSubmit={submit} className="grid gap-4">
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
                        <Field label="地点（选填）"><input name="location" defaultValue={editing?.location ?? ''} placeholder="地点" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="人数上限（选填）"><input name="maxParticipants" type="number" min={1} defaultValue={editing?.maxParticipants ?? ''} placeholder="人数上限" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="开始时间"><input name="startTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.startTime)} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                        <Field label="结束时间"><input name="endTime" type="datetime-local" required defaultValue={toDateTimeInput(editing?.endTime)} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" loading={pending}>{editing ? '保存活动' : '发布活动'}</Button>
                        <Button asChild variant="outline"><Link to="/admin/activities" search={{ page }}>取消</Link></Button>
                    </div>
                    </fieldset>
                </form>
    </AdminEditorLayout>
}

function toDateTimeInput(value?: string | Date | null) {
    if (!value) return ''
    const date = new Date(value)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
