// routes/_authed/admin/groups/pending.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { listPendingGroupsFn, approveGroupFn } from '~/functions'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/admin/groups/pending')({
    loader: async () => {
        const groups = await listPendingGroupsFn({ data: { page: 1, pageSize: 20 } })
        return { groups: groups?.items ?? [], total: groups?.total ?? 0 }
    },
    component: PendingGroupsComponent,
})

function PendingGroupsComponent() {
    const { groups, total } = Route.useLoaderData()
    const [processingId, setProcessingId] = useState<string | null>(null)

    const approveGroup = useServerFn(approveGroupFn)

    const handleApprove = async (groupId: string) => {
        setProcessingId(groupId)
        try {
            await approveGroup({ data: { id: groupId, approved: true } })
            window.location.reload() // 简单刷新
        } catch (error) {
            alert('审核失败')
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (groupId: string) => {
        const reason = prompt('请输入拒绝原因：')
        if (!reason) return
        
        setProcessingId(groupId)
        try {
            await approveGroupFn({ data: { id: groupId, approved: false, rejectedReason: reason } })
            window.location.reload() // 简单刷新
        } catch (error) {
            alert('拒绝失败')
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div>
            <h2 className="text-xl mb-4">待审核群组 (共 {total} 个)</h2>
            
            <div className="space-y-4">
                {groups.map((group) => (
                    <div key={group.id} className="border p-4 rounded">
                        <div className="flex justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">{group.name}</h3>
                                <p className="text-sm text-gray-600">slug: {group.slug}</p>
                                <p className="text-sm text-gray-600">分类: {group.category}</p>
                                <p className="text-sm mt-2">{group.description || '暂无描述'}</p>
                                <div className="mt-2 text-xs text-gray-400">
                                    {/* <span>创建者: {group.creator?.name || group.creatorId}</span> */}
                                    <span>创建者: {group.creatorId}</span>
                                    <span className="mx-2">•</span>
                                    <span>创建时间: {new Date(group.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleApprove(group.id)}
                                    disabled={processingId === group.id}
                                    className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
                                >
                                    通过
                                </button>
                                <button
                                    onClick={() => handleReject(group.id)}
                                    disabled={processingId === group.id}
                                    className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                                >
                                    拒绝
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {groups.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    暂无待审核群组
                </div>
            )}
        </div>
    )
}