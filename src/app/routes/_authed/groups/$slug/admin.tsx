import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { approveGroupFn, listAllGroupsFn } from '~/functions'
import { useState } from 'react'
import { Button, Card, EmptyState } from '@/components/coeer'


const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/$slug/admin')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 5

        const result = await listAllGroupsFn({
            data: {
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            }
        })
        return {
            pendingGroups: result?.items ?? [],
            total: result?.total ?? 0,
            pageSize
        }
    },
    component: GroupAdminPage,
})

function GroupAdminPage() {
    const { pendingGroups, total, pageSize } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const { group } = Route.useRouteContext()
    const navigate = Route.useNavigate()
    const { slug } = Route.useParams()

    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

    const totalPages = Math.ceil(total / pageSize)

    const handleApprove = async (groupId: string) => {
        setProcessingId(groupId)
        try {
            await approveGroupFn({
                data: {
                    id: groupId,
                    approved: true,
                },
            })
            // Refresh
            navigate({
                to: '/groups/$slug/admin',
                params: { slug },
            })
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (groupId: string) => {
        const reason = rejectReason[groupId]
        if (!reason?.trim()) {
            alert('请填写拒绝原因')
            return
        }

        setProcessingId(groupId)
        try {
            await approveGroupFn({
                data: {
                    id: groupId,
                    approved: false,
                    rejectedReason: reason,
                },
            })
            // Refresh
            navigate({
                to: '/groups/$slug/admin',
                params: { slug },
            })
        } finally {
            setProcessingId(null)
            setRejectReason(prev => ({ ...prev, [groupId]: '' }))
        }
    }

    return (
        <div className="space-y-6">
            <Card className="rounded-xl p-5">
                <h2 className="mb-4 text-[15px] font-medium">群组统计</h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <p className="text-2xl font-medium tabular-nums">{group.memberCount}</p>
                        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">成员数</p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <p className="text-2xl font-medium tabular-nums">{group.postCount || 0}</p>
                        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">帖子数</p>
                    </div>
                    <div className="rounded-xl border border-[hsl(var(--border))] p-4">
                        <p className="text-2xl font-medium tabular-nums">
                            {new Date(group.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">创建时间</p>
                    </div>
                </div>
            </Card>

            {pendingGroups.length > 0 && (
                <Card className="rounded-xl p-5">
                    <h2 className="mb-4 text-[15px] font-medium">待审核群组</h2>
                    <div className="space-y-4">
                        {pendingGroups.map((g) => (
                            <div key={g.id} className="flex flex-col gap-3 rounded-xl border border-[hsl(var(--border))] p-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-[15px] font-medium">{g.name}</p>
                                    <p className="text-[13px] text-[hsl(var(--muted-foreground))]">创建者：{g.creatorId}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleApprove(g.id)}
                                        disabled={processingId === g.id}
                                        loading={processingId === g.id}
                                    >
                                        通过
                                    </Button>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            value={rejectReason[g.id] || ''}
                                            onChange={(e) => setRejectReason(prev => ({
                                                ...prev,
                                                [g.id]: e.target.value
                                            }))}
                                            placeholder="拒绝原因"
                                            className="coeer-focus h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                                            disabled={processingId === g.id}
                                        />
                                        <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => handleReject(g.id)}
                                            disabled={processingId === g.id || !rejectReason[g.id]?.trim()}
                                            loading={processingId === g.id}
                                        >
                                            拒绝
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {pendingGroups.length === 0 && (
                <EmptyState title="暂无待审核群组" description="新的群组创建申请会显示在这里。" />
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, page: prev.page - 1 }),
                            })
                        }
                    >
                        上一页
                    </Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, page: prev.page + 1 }),
                            })
                        }
                    >
                        下一页
                    </Button>
                </div>
            )}
        </div>
    )
}
