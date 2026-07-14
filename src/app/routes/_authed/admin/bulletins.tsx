import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { BULLETIN_TYPE_ARRAY, BulletinType } from '@shared/constants'
import { Button, Card, EmptyState, SectionHeader, bulletinTypeLabels } from '@/components/coeer'
import { createBulletinFn, deleteBulletinFn, getBulletinFeedFn, updateBulletinFn } from '~/functions'

const searchSchema = z.object({ page: z.number().default(1) })

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
    const { bulletins } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [editing, setEditing] = useState<any | null>(null)

    const refresh = () => navigate({ to: '/admin/bulletins', search: { page } })

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = new FormData(e.currentTarget)
        const payload = {
            type: form.get('type') as BulletinType,
            title: form.get('title') as string,
            content: form.get('content') as string,
            isPinned: form.get('isPinned') === 'on',
        }
        if (editing?.id) await updateBulletinFn({ data: { id: editing.id, title: payload.title, content: payload.content, isPinned: payload.isPinned } })
        else await createBulletinFn({ data: payload })
        setEditing(null)
        refresh()
    }

    const remove = async (id: string) => {
        if (!confirm('确定删除这条公告吗？')) return
        await deleteBulletinFn({ data: { id } })
        refresh()
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="公告管理" description="发布、编辑和删除公告。" />
            <Card className="rounded-xl p-5">
                <form onSubmit={submit} className="grid gap-3">
                    <select name="type" defaultValue={editing?.type || 'official'} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                        {BULLETIN_TYPE_ARRAY.map((type) => <option key={type} value={type}>{bulletinTypeLabels[type]}</option>)}
                    </select>
                    <input name="title" required defaultValue={editing?.title} placeholder="公告标题" className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    <textarea name="content" required defaultValue={editing?.content} placeholder="公告内容" rows={4} className="coeer-focus resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm leading-6" />
                    <label className="flex items-center gap-2 text-sm"><input name="isPinned" type="checkbox" defaultChecked={editing?.isPinned} className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))]" />置顶</label>
                    <div className="flex gap-2">
                        <Button type="submit">{editing ? '保存公告' : '发布公告'}</Button>
                        {editing ? <Button type="button" variant="outline" onClick={() => setEditing(null)}>取消编辑</Button> : null}
                    </div>
                </form>
            </Card>
            {bulletins.length ? (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-xl">
                    {bulletins.map((item: any) => (
                        <div key={item.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-[15px] font-medium">{item.title}</p>
                                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">{bulletinTypeLabels[item.type] || item.type}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => setEditing(item)}>编辑</Button>
                                <Button variant="danger" onClick={() => remove(item.id)}>删除</Button>
                            </div>
                        </div>
                    ))}
                </Card>
            ) : <EmptyState title="暂无公告" />}
        </div>
    )
}
