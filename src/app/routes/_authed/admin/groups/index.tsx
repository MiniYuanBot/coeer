import { createFileRoute, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { useMemo, useState } from 'react'
import { deleteGroupFn, listAllGroupsFn } from '~/functions'
import { Badge, Button, Card, EmptyState, SearchInput, SectionHeader } from '@/components/coeer'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/groups/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 5
        const result = await listAllGroupsFn({
            data: {
                status: 'approved',
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            groups: result?.items ?? [],
            total: result?.total ?? 0,
            pageSize,
        }
    },
    component: AllGroupsManageComponent,
})

function AllGroupsManageComponent() {
    const { groups, total, pageSize } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [search, setSearch] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const totalPages = Math.ceil(total / pageSize)
    const visibleGroups = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return groups
        return groups.filter((group) =>
            group.name.toLowerCase().includes(keyword) ||
            group.slug.toLowerCase().includes(keyword) ||
            group.description?.toLowerCase().includes(keyword)
        )
    }, [groups, search])

    const handleDelete = async (groupId: string) => {
        if (!confirm('确定要删除这个群组吗？此操作不可恢复。')) return

        setDeletingId(groupId)
        try {
            await deleteGroupFn({ data: { groupId } })
            navigate({ to: '/admin/groups', search: { page } })
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="所有群组" description="管理已审核通过的群组。" />

            <Card className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索群组名称、slug 或描述" />
                <Badge tone="primary">共 {total} 个</Badge>
            </Card>

            {visibleGroups.length ? (
                <div className="grid gap-4">
                    {visibleGroups.map((group) => (
                        <Card key={group.id} className="p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold">{group.name}</h2>
                                        <Badge tone={group.isPublic ? 'success' : 'default'}>{group.isPublic ? '公开' : '私密'}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">slug: {group.slug}</p>
                                    {group.description ? (
                                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{group.description}</p>
                                    ) : null}
                                    <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">创建者：{group.creatorId}</p>
                                </div>
                                <Button variant="danger" loading={deletingId === group.id} onClick={() => handleDelete(group.id)}>
                                    删除
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-8">
                    <EmptyState title="没有匹配的群组" description="调整搜索关键词后再试试。" />
                </Card>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/admin/groups', search: { page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/admin/groups', search: { page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
