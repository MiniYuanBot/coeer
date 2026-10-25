import { Avatar } from '@/components/coeer/ui/Avatar'
import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { getGroupMembersFn, removeMemberFn, updateMemberRoleFn } from '~/functions'
import { useState } from 'react'
import { GROUP_MEMBER_STATUS, GroupMemberRole } from '@shared/constants'
import { GroupMemberFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, Pagination } from '@/components/coeer'

const searchSchema = z.object({
    ...GroupMemberFilterSchema.shape,
    page: z.number().int().min(1).default(1),
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
    const { isAdmin, isOwner } = Route.useRouteContext()
    const { members, total, group, pageSize } = Route.useLoaderData()
    const { status, page } = Route.useSearch()
    const navigate = useNavigate()
    const router = useRouter()
    const { slug } = Route.useParams()
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [actionError, setActionError] = useState('')

    const handleApprove = async (memberId: string, approved = true) => {
        setProcessingId(memberId)
        setActionError('')
        try {
            await updateMemberRoleFn({ data: { memberId, status: approved ? 'approved' : 'rejected' } })
            await router.invalidate()
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '审核失败，请重试')
        } finally {
            setProcessingId(null)
        }
    }

    const handleRemove = async (memberId: string) => {
        if (!confirm('确定要移除该成员吗？')) return

        setProcessingId(memberId)
        setActionError('')
        try {
            await removeMemberFn({ data: { memberId } })
            await router.invalidate()
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '移除失败，请重试')
        } finally {
            setProcessingId(null)
        }
    }

    const handleRoleChange = async (memberId: string, role: string) => {
        if (role === 'owner' && !confirm('转让后你将成为普通成员，确定转让群主身份吗？')) return
        setProcessingId(memberId)
        setActionError('')
        try {
            await updateMemberRoleFn({
                data: { memberId, role: role as GroupMemberRole },
            })
            await router.invalidate()
        } catch (error) {
            setActionError(error instanceof Error ? error.message : '角色更新失败，请重试')
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <PageLayout level="h2"
            title="群组成员"
            description="查看群组成员与入群申请。每群 1 名群主、至多 3 名管理员，仅群主可以调整身份。"
            filters={{
                onClear: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: undefined, page: 1 } }),
                groups: [
                    {
                        title: '成员状态',
                        items: [
                            { key: 'all', label: '全部', active: !status, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: undefined, page: 1 } }) },
                            { key: 'approved', label: '已通过', active: status === GROUP_MEMBER_STATUS.APPROVED, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: GROUP_MEMBER_STATUS.APPROVED, page: 1 } }) },
                            ...(isAdmin ? [{ key: 'pending', label: '待审核', active: status === GROUP_MEMBER_STATUS.PENDING, onClick: () => navigate({ to: '/groups/$slug/members', params: { slug }, search: { status: GROUP_MEMBER_STATUS.PENDING, page: 1 } }) }] : []),
                        ],
                    },
                ]
            }}>

            {actionError ? <p role="alert" className="text-sm text-danger">{actionError}</p> : null}

            {members.length === 0 ? (
                <EmptyState title="暂无成员" description="成员加入或申请后会显示在这里。" />
            ) : (
                <Card className="divide-y divide-[hsl(var(--border))] rounded-lg">
                    {members.map((member) => (
                        <div key={member.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <Avatar src={member.user.avatarUrl} name={member.user.name} />
                                <div>
                                    <p className="text-[15px] font-medium">{member.user.name}</p>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                        <Badge>{member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : '成员'}</Badge>
                                        {member.status === 'pending' ? <Badge tone="warning">待审核</Badge> : member.status === 'rejected' ? <Badge tone="danger">已拒绝</Badge> : <Badge tone="success">已通过</Badge>}
                                    </div>
                                </div>
                            </div>

                            {isAdmin && member.role !== 'owner' && (
                                <div className="flex flex-wrap items-center gap-2">
                                    {member.status === 'pending' && (
                                        <><Button
                                            size="sm"
                                            onClick={() => handleApprove(member.id)}
                                            disabled={processingId !== null}
                                            loading={processingId === member.id}
                                        >
                                            通过
                                        </Button><Button size="sm" variant="outline" disabled={processingId !== null} onClick={() => void handleApprove(member.id, false)}>拒绝</Button></>
                                    )}

                                    {isOwner && member.status === 'approved' ? <select
                                        aria-label={`调整 ${member.user.name || '成员'} 的角色`}
                                        value={member.role}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        disabled={processingId !== null}
                                        className="coeer-field coeer-focus h-8 rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm disabled:bg-muted disabled:text-muted-foreground"
                                    >
                                        <option value="member">成员</option>
                                        <option value="admin">管理员</option>
                                        <option value="owner">转让群主</option>
                                    </select> : null}

                                    <Button
                                        size="sm"
                                        variant="danger"
                                        onClick={() => handleRemove(member.id)}
                                        disabled={processingId !== null}
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

            <Pagination total={total} page={page} size={pageSize} onChange={(page) => void navigate({ to: '/groups/$slug/members', params: { slug }, search: { status, page } })} />
        </PageLayout>
    )
}
