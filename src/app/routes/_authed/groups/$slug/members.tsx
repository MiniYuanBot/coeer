import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { getGroupMembersFn, approveMemberFn, removeMemberFn, updateMemberRoleFn } from '~/functions'
import { useState } from 'react'
import { GroupMemberRoles } from '@shared/constants'

const searchSchema = z.object({
    status: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/$slug/members')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, deps: { search } }) => {
        const { group } = context
        const result = await getGroupMembersFn({
            data: {
                groupId: group.id,
                status: search.status as any,
                page: search.page,
                pageSize: 20,
            },
        })
        return { members: result?.items ?? [], total: result?.total ?? 0, group }
    },
    component: GroupMembersPage,
})

function GroupMembersPage() {
    const { isAdmin } = Route.useRouteContext()
    const { members, total, group } = Route.useLoaderData()
    const { status, page } = Route.useSearch()
    const navigate = useNavigate()
    const { slug } = Route.useParams()
    const [processingId, setProcessingId] = useState<string | null>(null)

    const totalPages = Math.ceil(total / 20)

    const handleApprove = async (memberId: string) => {
        setProcessingId(memberId)
        try {
            await approveMemberFn({ data: { memberId } })
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
                data: { memberId, role: role as GroupMemberRoles },
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
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">群组成员</h2>
                <div className="flex gap-2">
                    {[
                        { value: '', label: '全部' },
                        { value: 'approved', label: '已通过' },
                        { value: 'pending', label: '待审核' },
                    ].map((item) => (
                        <Link
                            key={item.value || 'all'}
                            to="/groups/$slug/members"
                            params={{ slug }}
                            search={{ status: item.value || undefined, page: 1 }}
                            className={`px-3 py-1 rounded-full text-sm ${(status || '') === item.value
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </div>
            </div>

            {members.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-gray-500">暂无成员</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
                    {members.map((member) => (
                        <div key={member.id} className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div>
                                    <p className="font-medium text-gray-900">{member.user.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {member.role === 'admin' && '管理员'}
                                        {member.role === 'member' && '成员'}
                                        {member.status === 'pending' && ' · 待审核'}
                                    </p>
                                </div>
                            </div>

                            {isAdmin && member.user.id !== group.creatorId && (
                                <div className="flex items-center gap-2">
                                    {member.status === 'pending' && (
                                        <button
                                            onClick={() => handleApprove(member.id)}
                                            disabled={processingId === member.id}
                                            className="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-200 rounded hover:bg-green-50 disabled:opacity-50"
                                        >
                                            {processingId === member.id ? '处理中...' : '通过'}
                                        </button>
                                    )}

                                    <select
                                        value={member.role}
                                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                        disabled={processingId === member.id}
                                        className="text-sm border-gray-300 rounded-md focus:ring-blue-500 disabled:opacity-50"
                                    >
                                        <option value="MEMBER">成员</option>
                                        <option value="MODERATOR">版主</option>
                                        <option value="ADMIN">管理员</option>
                                    </select>

                                    <button
                                        onClick={() => handleRemove(member.id)}
                                        disabled={processingId === member.id}
                                        className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                    >
                                        {processingId === member.id ? '处理中...' : '移除'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Link
                        to="/groups/$slug/members"
                        params={{ slug }}
                        search={{ status, page: page - 1 }}
                        disabled={page <= 1}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        上一页
                    </Link>
                    <span className="text-sm text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <Link
                        to="/groups/$slug/members"
                        params={{ slug }}
                        search={{ status, page: page + 1 }}
                        disabled={page >= totalPages}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        下一页
                    </Link>
                </div>
            )}
        </div>
    )
}