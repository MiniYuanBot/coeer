import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { Bulletin as RecordDefinition } from '~/database/schemas/bulletins'
import { Button } from '@/components/coeer'
import { AdminEditorLayout } from '../-editor-layout'
import { Field } from '@/components/coeer/ui/Field'
import { MarkdownEditor } from '@/components/coeer/ui/MarkdownEditor'
import { BULLETIN_TYPE_ARRAY, type BulletinType } from '@shared/constants'
import { bulletinTypeLabels } from '@/components/coeer'
import { createBulletinFn, updateBulletinFn } from '~/functions'

export function BulletinForm({ editing, page }: { editing?: RecordDefinition; page: number }) {
    const navigate = useNavigate()
    const router = useRouter()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const finish = async () => {
        await router.invalidate()
        await navigate({ to: '/admin/bulletins', search: { page } })
    }

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (pending) return
        setError('')
        const element = e.currentTarget
        const form = new FormData(element)
        const payload = {
            type: form.get('type') as BulletinType,
            title: form.get('title') as string,
            content: form.get('content') as string,
            isPinned: form.get('isPinned') === 'on',
            notificationMode: form.get('notificationMode') as 'none' | 'modal' | 'banner',
        }
        setPending(true)
        try {
            const result = editing?.id
                ? await updateBulletinFn({ data: { id: editing.id, title: payload.title, content: payload.content, isPinned: payload.isPinned, notificationMode: payload.notificationMode } })
                : await createBulletinFn({ data: payload })
            if (!result.success) throw new Error(result.state.message || '保存公告失败')
            await finish()
        } catch (error) {
            setError(error instanceof Error ? error.message : '保存公告失败，请重试')
        } finally { setPending(false) }
    }

    return <AdminEditorLayout title={editing ? '编辑公告' : '新建公告'} backTo="/admin/bulletins" page={page}>
        {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form onSubmit={submit} className="grid gap-4">
                    <fieldset disabled={pending} className="grid min-w-0 gap-4">
                    <Field label="类型"><select name="type" disabled={!!editing} defaultValue={editing?.type || 'official'} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        {BULLETIN_TYPE_ARRAY.map((type) => <option key={type} value={type}>{bulletinTypeLabels[type]}</option>)}
                    </select></Field>
                    <Field label="标题"><input name="title" required defaultValue={editing?.title} placeholder="公告标题" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    <MarkdownEditor label="内容" name="content" required maxLength={5000} defaultValue={editing?.content} placeholder="公告内容" rows={6} />
                    <Field label="通知方式"><select name="notificationMode" defaultValue={editing?.notificationMode || 'none'} className="coeer-field coeer-focus rounded-lg border border-control-border bg-card p-3 text-sm">
                        <option value="none">无特殊通知</option><option value="modal">居中弹窗</option><option value="banner">顶部横幅</option>
                    </select></Field>
                    <label className="flex items-center gap-2 text-sm"><input name="isPinned" type="checkbox" defaultChecked={editing?.isPinned} className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />置顶</label>
                    <div className="flex gap-2">
                        <Button type="submit" loading={pending}>{editing ? '保存公告' : '发布公告'}</Button>
                        <Button asChild variant="outline"><Link to="/admin/bulletins" search={{ page }}>取消</Link></Button>
                    </div>
                    </fieldset>
                </form>
    </AdminEditorLayout>
}
