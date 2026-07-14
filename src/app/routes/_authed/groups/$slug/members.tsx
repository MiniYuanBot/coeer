import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { getGroupMembersFn, removeMemberFn, updateMemberRoleFn } from '~/functions'
import { useState } from 'react'
import { GROUP_MEMBER_STATUS, GroupMemberRole } from '@shared/constants'
import { GroupMemberFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, FilterPanel, SectionHeader } from '@/components/coeer'

const searchSchema = z.object({
    ...GroupMemberFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/$slug/members')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, deps: { search } }) => {
        const { group } = context
        const pageSize = 5

        const result = await getGroupMembersFn({
            data: {
                groupId: group.id,
                status: search.status as any,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            members: result?.items ?? [],
            total: result?.total ?? 0,
            group,
            pageSize,
        }
    },
    component: GroupMembersPage,
})

function GroupMembersPage() {
    const { isAdmin } = Route.useRouteContext()
    const { members, total, group, pageSize } = Route.useLoaderData()
    const { status, page } = Route.useSearch()
    const navigate = useNavigate()
    const { slug } = Route.useParams()
    const [processingId, setProcessingId] = useState<string | null>(null)

    const totalPages = Math.ceil(total / pageSize)

    const handleApprove = async (memberId: string) => {
        setProcessingId(memberId)
        try {
            await updateMemberRoleFn({ data: { memberId, status: 'approved' } })
            // Refresh
            navigate({
                to: '/groups/$slug/members',
                params: { slug },
                search: { status, page },
            })
        } finally {
            setProcessingId(null)
        }
    }

    const handleRemove = async (memberId: string) => {
        if (!confirm('确定要移除该成员吗？')) return

        setProcessingId(memberId)
        try {
            await removeMemberFn({ data: { memberId } })
            navigate({
                to: '/groups/$slug/members',
                params: { slug },
                search: { status, page },
            })
        } finally {
            setProcessingId(null)
        }
    }

    const handleRoleChange = async (memberId: string, role: string) => {
        setProcessingId(memberId)
        try {
            await updateMemberRoleFn({
                data: { memberId, role: role as GroupMemberRole },
            })
            navigate({
                to: '/groups/$slug/members',
                params: { slug },
                search: { status, page },
            })
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="群组成员" description={`共 ${total} 名成员或申请记录。`} />

            <FilterPanel
                searchPlaceholder="成员页暂不支持搜索"
                onSearch={() => undefined}
                groups={[
                    {
                        items: [
                            { key: 'all', label: '全部', active: !status, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: undefined, page: 1 } }) },
                            { key: 'approved', label: '已通过', active: status === GROUP_MEMBER_STATUS.APPROVED, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: GROUP_MEMBER_STATUS.APPROVED, page: 1 } }) },
                            { key: 'pending', label: '待审核', active: status === GROUP_MEMBER_STATUS.PENDING, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: GROUP_MEMBER_STATUS.PENDING, page: 1 } }) },
                        ],
                    },
                ]}
            />

            {members.length === 0 ? (
                <EmptyState title="暂无成员" description="成员加入或申请后会显示在这里。" />
            ) : (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-xl">
                    {members.map((member) => (
                        <div key={member.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
                                    {member.user.name?.[0] || 'U'}
                                </div>
                                <div>
                                    <p className="text-[15px] font-medium">{member.user.name}</p>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <Badge>{member.role === 'admin' ? '管理员' : '成员'}</Badge>
                                        {member.status === 'pending' ? <Badge tone="warning">待审核</Badge> : <Badge tone="success">已通过</Badge>}
                                    </div>
                                </div>
                            </div>

                            {isAdmin && member.user.id !== group.creatorId && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {member.status === 'pending' && (
                                        <Button
                                            size="sm"
                                            onClick={() => handleApprove(member.id)}
                                            disabled={processingId === member.id}
                                            loading={processingId === member.id}
                                        >
                                            通过
                                        </Button>
                                    )}

                                    <select
                                        value={member.role}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        disabled={processingId === member.id}
                                        className="coeer-focus h-8 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm disabled:opacity-50"
                                    >
                                        <option value="member">成员</option>
                                        <option value="admin">管理员</option>
                                    </select>

                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleRemove(member.id)}
                                        disabled={processingId === member.id}
                                        loading={processingId === member.id}
                                    >
                                        移除
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </Card>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status, page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                        {page} / {totalPages}
                    </span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status, page: page + 1 } })}>下一页</Button>
                </div>
            )}
        </div>
    )
}
