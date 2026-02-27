import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { approveGroupFn, listPendingGroupsFn } from '~/functions'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/groups/$slug/admin')({
    loader: async () => {
        const result = await listPendingGroupsFn({ data: { page: 1, pageSize: 10 } })
        return { pendingGroups: result?.items ?? [] }
    },
    component: GroupAdminPage,
})

function GroupAdminPage() {
    const { pendingGroups } = Route.useLoaderData()
    const { group } = Route.useRouteContext()
    const navigate = useNavigate()
    const { slug } = Route.useParams()

    const [processingId, setProcessingId] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

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
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">群组统计</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{group.memberCount}</p>
                        <p className="text-sm text-gray-500">成员数</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">{group.postCount || 0}</p>
                        <p className="text-sm text-gray-500">帖子数</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold text-gray-900">
                            {new Date(group.createdAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">创建时间</p>
                    </div>
                </div>
            </div>

            {pendingGroups.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">待审核群组</h2>
                    <div className="space-y-4">
                        {pendingGroups.map((g) => (
                            <div key={g.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">{g.name}</p>
                                    <p className="text-sm text-gray-500">创建者: {g.creatorId}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApprove(g.id)}
                                        disabled={processingId === g.id}
                                        className="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-200 rounded hover:bg-green-50 disabled:opacity-50"
                                    >
                                        {processingId === g.id ? '处理中...' : '通过'}
                                    </button>

                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="text"
                                            value={rejectReason[g.id] || ''}
                                            onChange={(e) => setRejectReason(prev => ({
                                                ...prev,
                                                [g.id]: e.target.value
                                            }))}
                                            placeholder="拒绝原因"
                                            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                                            disabled={processingId === g.id}
                                        />
                                        <button
                                            onClick={() => handleReject(g.id)}
                                            disabled={processingId === g.id || !rejectReason[g.id]?.trim()}
                                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50"
                                        >
                                            {processingId === g.id ? '处理中...' : '拒绝'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {pendingGroups.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                    <p className="text-gray-500">暂无待审核群组</p>
                </div>
            )}
        </div>
    )
}