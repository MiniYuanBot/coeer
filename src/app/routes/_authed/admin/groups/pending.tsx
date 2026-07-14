import z from 'zod'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { approveGroupFn, listAllGroupsFn } from '~/functions'
import { Badge, Button, Card, EmptyState, SectionHeader, formatDateTime } from '@/components/coeer'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/groups/pending')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 5
        const result = await listAllGroupsFn({
            data: {
                status: 'pending',
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
    component: PendingGroupsComponent,
})

function PendingGroupsComponent() {
    const { groups, total, pageSize } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [processingId, setProcessingId] = useState<string | null>(null)
    const totalPages = Math.ceil(total / pageSize)

    const handleApprove = async (groupId: string) => {
        setProcessingId(groupId)
        try {
            await approveGroupFn({ data: { id: groupId, approved: true } })
            navigate({ to: '/admin/groups/pending', search: { page } })
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (groupId: string) => {
        const rejectedReason = prompt('请输入拒绝原因：')
        if (!rejectedReason) return

        setProcessingId(groupId)
        try {
            await approveGroupFn({ data: { id: groupId, approved: false, rejectedReason } })
            navigate({ to: '/admin/groups/pending', search: { page } })
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="待审核群组" description="审核用户创建的群组申请。" />

            <Card className="p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    当前有 <span className="font-semibold text-[hsl(var(--foreground))]">{total}</span> 个群组等待审核。
                </p>
            </Card>

            {groups.length ? (
                <div className="grid gap-4">
                    {groups.map((group) => (
                        <Card key={group.id} className="p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="font-semibold">{group.name}</h2>
                                        {group.category ? <Badge>{group.category}</Badge> : null}
                                        <Badge tone={group.isPublic ? 'success' : 'default'}>{group.isPublic ? '公开' : '私密'}</Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">slug: {group.slug}</p>
                                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{group.description || '暂无描述'}</p>
                                    <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                                        创建者：{group.creatorId} · 创建时间：{formatDateTime(group.createdAt)}
                                    </p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button loading={processingId === group.id} onClick={() => handleApprove(group.id)}>
                                        通过
                                    </Button>
                                    <Button variant="danger" loading={processingId === group.id} onClick={() => handleReject(group.id)}>
                                        拒绝
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-8">
                    <EmptyState title="暂无待审核群组" description="新的群组申请会出现在这里。" />
                </Card>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/admin/groups/pending', search: { page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/admin/groups/pending', search: { page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
