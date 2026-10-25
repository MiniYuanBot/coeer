import { Field } from '@/components/coeer/ui/Field'
import { EditorSection } from '@/components/coeer/ui/EditorSection'
import { MarkdownEditor } from '@/components/coeer/ui/MarkdownEditor'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { BULLETIN_TYPE_ARRAY, BulletinType } from '@shared/constants'
import { Button, Card, EmptyState, Pagination, SectionHeader, bulletinTypeLabels } from '@/components/coeer'
import { createBulletinFn, deleteBulletinFn, getBulletinFeedFn, updateBulletinFn } from '~/functions'

const searchSchema = z.object({ page: z.number().int().min(1).default(1) })

export const Route = createFileRoute('/_authed/admin/bulletins')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 20
        const result = await getBulletinFeedFn({ data: { limit: pageSize, offset: (search.page - 1) * pageSize } })
        return { bulletins: result.data?.items ?? [], total: result.data?.total ?? 0, pageSize }
    },
    component: AdminBulletinsPage,
})

function AdminBulletinsPage() {
    const { bulletins, total = 0 } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)
    const [error, setError] = useState('')
    const [editorRevision, setEditorRevision] = useState(0)
    const [pending, setPending] = useState(false)

    const refresh = () => navigate({ to: '/admin/bulletins', search: { page } })

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
        }
        setPending(true)
        try {
            const result = editing?.id
                ? await updateBulletinFn({ data: { id: editing.id, title: payload.title, content: payload.content, isPinned: payload.isPinned } })
                : await createBulletinFn({ data: payload })
            if (!result.success) throw new Error(result.state.message || '保存公告失败')
            element.reset()
            setEditing(null)
            setEditorRevision(value => value + 1)
            refresh()
        } catch (error) {
            setError(error instanceof Error ? error.message : '保存公告失败，请重试')
        } finally { setPending(false) }
    }

    const remove = async (id: string) => {
        if (!confirm('确定删除这条公告吗？')) return
        await deleteBulletinFn({ data: { id } })
        refresh()
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="公告管理" description="发布、编辑和删除公告。最多置顶 5 条公告。" />
            <EditorSection title={editing ? '编辑公告' : '新建公告'} editKey={editing?.id} attention={!!error} listTitle="全部公告" resetKey={editorRevision} records={<>
            {bulletins.length ? (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-lg">
                    {bulletins.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-[15px] font-medium">{item.title}</p>
                                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{bulletinTypeLabels[item.type] || item.type}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" disabled={pending} onClick={() => { setEditing(item); setError(''); setEditorRevision(value => value + 1) }}>编辑</Button>
                                <Button variant="danger" disabled={pending} onClick={() => remove(item.id)}>删除</Button>
                            </div>
                        </div>
                    ))}
                </Card>
            ) : <EmptyState title="暂无公告" />}
            <Pagination total={total} page={page} size={20} onChange={(page) => void navigate({ to: '/admin/bulletins', search: { page } })} />
            </>}>
                {error ? <p role="alert" className="mb-4 text-sm text-danger">{error}</p> : null}
                <form key={editing?.id || 'new'} onSubmit={submit} className="grid gap-4">
                    <fieldset disabled={pending} className="grid min-w-0 gap-4">
                    <Field label="类型"><select name="type" defaultValue={editing?.type || 'official'} className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        {BULLETIN_TYPE_ARRAY.map((type) => <option key={type} value={type}>{bulletinTypeLabels[type]}</option>)}
                    </select></Field>
                    <Field label="标题"><input name="title" required defaultValue={editing?.title} placeholder="公告标题" className="coeer-field coeer-focus h-10 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm" /></Field>
                    <MarkdownEditor label="内容" name="content" required maxLength={5000} defaultValue={editing?.content} placeholder="公告内容" rows={6} />
                    <label className="flex items-center gap-2 text-sm"><input name="isPinned" type="checkbox" defaultChecked={editing?.isPinned} className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />置顶</label>
                    <div className="flex gap-2">
                        <Button type="submit" loading={pending}>{editing ? '保存公告' : '发布公告'}</Button>
                        {editing ? <Button type="button" variant="outline" onClick={() => { setEditing(null); setError('') }}>取消编辑</Button> : null}
                    </div>
                    </fieldset>
                </form>
            </EditorSection>
        </div>
    )
}
