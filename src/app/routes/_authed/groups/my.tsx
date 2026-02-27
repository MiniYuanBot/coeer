import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { listMyGroupsFn, leaveGroupFn } from '~/functions'
import { useState } from 'react'

const pageSize = 5

const searchSchema = z.object({
    status: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/my')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const result = await listMyGroupsFn({
            data: {
                status: search.status as any,
                page: search.page,
                pageSize: pageSize,
            },
        })
        return {
            members: result?.items ?? [],
            total: result?.total ?? 0
        }
    },
    component: GroupsMyPage,
})

function GroupsMyPage() {
    const { members, total } = Route.useLoaderData()
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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">我的群组</h1>
                <Link
                    to="/groups/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                    创建群组
                </Link>
            </div>

            <div className="flex gap-2 bg-white p-4 rounded-lg shadow-sm">
                {[
                    { value: '', label: '全部' },
                    { value: 'approved', label: '已通过' },
                    { value: 'pending', label: '审核中' },
                ].map((item) => (
                    <Link
                        key={item.value || 'all'}
                        to="/groups/my"
                        search={{
                            status: item.value || undefined,
                            page: 1,
                        }}
                        className={`px-3 py-1 rounded-full text-sm ${(status || '') === item.value
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>

            {members.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-gray-500">您还没有加入任何群组</p>
                    <Link
                        to="/groups/all"
                        className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                    >
                        去发现群组
                    </Link>
                </div>
            ) : (
                <div className="space-y-4">
                    {members.map((member) => (
                        <div
                            key={member.id}
                            className="bg-white rounded-lg shadow-sm p-6 flex items-center justify-between"
                        >
                            <Link
                                to="/groups/$slug"
                                params={{ slug: member.group.slug }}
                                className="flex-1"
                            >
                                <div className="flex items-center gap-4">
                                    {/* {member.group.avatarUrl ? (
                                        <img
                                            src={member.group.avatarUrl}
                                            alt=""
                                            className="w-12 h-12 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold">
                                            {member.group.name[0]}
                                        </div>
                                    )} */}
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {member.group.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {member.role === 'admin' && '群主'}
                                            {member.role === 'member' && '成员'} ·
                                            {member.status === 'approved' ? '已加入' : '审核中'}
                                        </p>
                                    </div>
                                </div>
                            </Link>
                            <button
                                onClick={() => handleLeave(member.groupId)}
                                disabled={leavingId === member.groupId}
                                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {leavingId === member.groupId ? '退出中...' : '退出'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        disabled={page <= 1}
                        onClick={() =>
                            navigate({
                                to: '/groups/my',
                                search: { status, page: page - 1 },
                            })
                        }
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        上一页
                    </button>
                    <span className="text-sm text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() =>
                            navigate({
                                to: '/groups/my',
                                search: { status, page: page + 1 },
                            })
                        }
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    )
}