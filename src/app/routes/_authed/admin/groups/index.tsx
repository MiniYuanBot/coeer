import { createFileRoute, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { useState } from 'react'
import { GROUP_STATUS_ARRAY, GroupStatus } from '@shared/constants'
import { deleteGroupFn, listAllGroupsFn, updateGroupStatusFn } from '~/functions'
import { Badge, Button, Card, EmptyState, FilterPanel, Modal, Pagination, SectionHeader, groupStatusLabels } from '@/components/coeer'

const searchSchema = z.object({
    status: z.enum(['all', 'pending']).default('all'),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/admin/groups/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 10
        const result = await listAllGroupsFn({
            data: {
                status: search.status === 'pending' ? 'pending' : undefined,
                search: search.search,
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
    const { status, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const [reviewing, setReviewing] = useState<any | null>(null)

    const refresh = () => navigate({ to: '/admin/groups', search: { status, search, page } })

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
            <FilterPanel searchValue={search} searchPlaceholder="搜索群组名称、slug 或描述"
                onSearch={(search) => void navigate({ to: '/admin/groups', search: { status, search: search || undefined, page: 1 } })}
                groups={[{ title: '状态', items: [
                    { key: 'all', label: '全部群组', active: status === 'all', onClick: () => void navigate({ to: '/admin/groups', search: { status: 'all', search, page: 1 } }) },
                    { key: 'pending', label: '待审核群组', active: status === 'pending', onClick: () => void navigate({ to: '/admin/groups', search: { status: 'pending', search, page: 1 } }) },
                ] }]} />
            {groups.length ? (
                <Card className="divide-y divide-[hsl(var(--border))]">
                    {groups.map((group) => (
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
            <Pagination total={total} page={page} size={pageSize} onChange={(page) => void navigate({ to: '/admin/groups', search: { status, search, page } })} />
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
