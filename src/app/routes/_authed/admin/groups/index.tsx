import { createFileRoute, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { useState } from 'react'
import { GROUP_STATUS_ARRAY, GroupStatus } from '@shared/constants'
import { deleteGroupFn, listAllGroupsFn, updateGroupStatusFn } from '~/functions'
import { Badge, Button, Card, EmptyState, Modal, SearchInput, SectionHeader, groupStatusLabels } from '@/components/coeer'

const searchSchema = z.object({
    status: z.enum(['all', 'pending']).default('all'),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/groups/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 10
        const result = await listAllGroupsFn({
            data: {
                status: search.status === 'pending' ? 'pending' : undefined,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return { groups: result?.items ?? [], total: result?.total ?? 0, pageSize }
    },
    component: AdminGroupsPage,
})

function AdminGroupsPage() {
    const { groups, total, pageSize } = Route.useLoaderData()
    const { status, page } = Route.useSearch()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [reviewing, setReviewing] = useState<any | null>(null)
    const totalPages = Math.ceil(total / pageSize)
    const visibleGroups = groups.filter((group) => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return true
        return group.name.toLowerCase().includes(keyword) || group.slug.toLowerCase().includes(keyword) || group.description?.toLowerCase().includes(keyword)
    })

    const refresh = () => navigate({ to: '/admin/groups', search: { status, page } })

    const submitReview = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!reviewing) return
        const form = new FormData(e.currentTarget)
        await updateGroupStatusFn({
            data: {
                id: reviewing.id,
                status: form.get('status') as GroupStatus,
                reviewNote: (form.get('reviewNote') as string) || undefined,
            },
        })
        setReviewing(null)
        refresh()
    }

    const remove = async (groupId: string) => {
        if (!confirm('确定删除这个群组吗？')) return
        await deleteGroupFn({ data: { groupId } })
        refresh()
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="群组审核" description="查看全部群组或仅查看待审核群组，并设置审核状态与备注。" />
            <Card className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索群组名称、slug 或描述" />
                <select value={status} onChange={(e) => navigate({ to: '/admin/groups', search: { status: e.target.value as 'all' | 'pending', page: 1 } })} className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                    <option value="all">全部群组</option>
                    <option value="pending">待审核群组</option>
                </select>
                <Badge tone="primary">共 {total} 个</Badge>
            </Card>
            {visibleGroups.length ? (
                <Card className="divide-y divide-[hsl(var(--border))]">
                    {visibleGroups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{group.name}</p>
                                    <Badge>{groupStatusLabels[group.status] || group.status}</Badge>
                                    <Badge tone={group.isPublic ? 'success' : 'default'}>{group.isPublic ? '公开' : '私密'}</Badge>
                                </div>
                                <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">slug: {group.slug}</p>
                                {group.reviewNote ? <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">备注：{group.reviewNote}</p> : null}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setReviewing(group)}>审核</Button>
                                <Button variant="danger" onClick={() => remove(group.id)}>删除</Button>
                            </div>
                        </div>
                    ))}
                </Card>
            ) : <EmptyState title="没有匹配的群组" />}
            {totalPages > 1 ? <div className="flex items-center justify-center gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/admin/groups', search: { status, page: page - 1 } })}>上一页</Button><span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span><Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/admin/groups', search: { status, page: page + 1 } })}>下一页</Button></div> : null}
            <Modal open={!!reviewing} title="审核群组" onOpenChange={(open) => !open && setReviewing(null)}>
                <form onSubmit={submitReview} className="space-y-4">
                    <label className="block text-sm font-medium">审核状态
                        <select name="status" defaultValue={reviewing?.status || 'pending'} className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                            {GROUP_STATUS_ARRAY.map((item) => <option key={item} value={item}>{groupStatusLabels[item]}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm font-medium">审核备注
                        <textarea name="reviewNote" defaultValue={reviewing?.reviewNote || ''} rows={4} className="coeer-focus mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm" />
                    </label>
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setReviewing(null)}>取消</Button><Button type="submit">保存</Button></div>
                </form>
            </Modal>
        </div>
    )
}
