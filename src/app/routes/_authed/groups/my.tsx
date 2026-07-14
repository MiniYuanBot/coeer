import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { listMyGroupsFn, leaveGroupFn } from '~/functions'
import { useState } from 'react'
import { Badge, Button, Card, EmptyState, SectionHeader } from '@/components/coeer'
import { GroupFilterSchema } from '@shared/contracts'
import { GROUP_STATUS } from '@shared/constants'


const searchSchema = z.object({
    ...GroupFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/my')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 5

        const result = await listMyGroupsFn({
            data: {
                status: search.status,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            members: result?.items ?? [],
            total: result?.total ?? 0,
            pageSize
        }
    },
    component: GroupsMyPage,
})

function GroupsMyPage() {
    const { members, total, pageSize } = Route.useLoaderData()
    const { status, page } = Route.useSearch()
    const navigate = useNavigate()
    const [leavingId, setLeavingId] = useState<string | null>(null)

    const totalPages = Math.ceil(total / pageSize)

    const handleLeave = async (groupId: string) => {
        if (!confirm('确定要退出这个群组吗？')) return

        setLeavingId(groupId)
        try {
            await leaveGroupFn({ data: { groupId } })
            navigate({
                to: '/groups/my',
                search: { status, page },
            })
        } finally {
            setLeavingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="我的群组"
                description="管理你加入和创建的群组。"
                action={<Link to="/groups/create"><Button>创建群组</Button></Link>}
            />

            <Card className="flex gap-2 p-4">
                {[
                    { value: undefined, label: '全部' },
                    { value: GROUP_STATUS.APPROVED, label: '已通过' },
                    { value: GROUP_STATUS.PENDING, label: '审核中' },
                ].map((item) => (
                    <Link
                        key={item.value || 'all'}
                        to="/groups/my"
                        search={{
                            status: item.value || undefined,
                            page: 1,
                        }}
                        className="contents"
                    >
                        <Badge tone={(status || '') === item.value ? 'primary' : 'default'}>{item.label}</Badge>
                    </Link>
                ))}
            </Card>

            {members.length === 0 ? (
                <EmptyState title="您还没有加入任何群组" action={<Link to="/groups/all"><Button variant="outline">去发现群组</Button></Link>} />
            ) : (
                <div className="space-y-4">
                    {members.map((member) => (
                        <Card key={member.id} className="flex flex-col gap-3 rounded-xl p-5 md:flex-row md:items-center md:justify-between">
                            <Link
                                to="/groups/$slug"
                                params={{ slug: member.group.slug }}
                                className="flex-1"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
                                        {member.group.name[0]}
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-medium">
                                            {member.group.name}
                                        </h3>
                                        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
                                            {member.role === 'admin' && '群主'}
                                            {member.role === 'member' && '成员'} ·
                                            {member.status === 'approved' ? '已加入' : '审核中'}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                            <Button
                                variant="outline"
                                onClick={() => handleLeave(member.groupId)}
                                disabled={leavingId === member.groupId}
                                loading={leavingId === member.groupId}
                                className="text-rose-600 hover:text-rose-700 dark:text-rose-400"
                            >
                                退出
                            </Button>
                        </Card>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() =>
                            navigate({
                                to: '/groups/my',
                                search: { status, page: page - 1 },
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
                                to: '/groups/my',
                                search: { status, page: page + 1 },
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
