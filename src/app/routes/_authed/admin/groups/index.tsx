// routes/_authed/admin/groups/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { listApprovedGroupsFn, deleteGroupFn } from '~/functions'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/admin/groups/')({
    loader: async () => {
        const groups = await listApprovedGroupsFn({ data: { page: 1, pageSize: 50 } })
        return { groups: groups?.items ?? [], total: groups?.total ?? 0 }
    },
    component: AllGroupsManageComponent,
})

function AllGroupsManageComponent() {
    const { groups, total } = Route.useLoaderData()
    const [search, setSearch] = useState('')
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const deleteGroup = useServerFn(deleteGroupFn)

    const handleDelete = async (groupId: string) => {
        if (!confirm('确定要删除这个群组吗？此操作不可恢复！')) {
            return
        }
        
        setDeletingId(groupId)
        try {
            await deleteGroup({ data: { id: groupId } })
            // 刷新列表
            window.location.reload()
        } catch (error) {
            alert('删除失败')
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl">所有群组 (共 {total} 个)</h2>
                <input
                    type="text"
                    placeholder="搜索群组..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-3 py-2 border rounded"
                />
            </div>
            
            <div className="space-y-2">
                {groups.map((group) => (
                    <div key={group.id} className="border p-4 rounded flex justify-between items-center">
                        <div>
                            <h3 className="font-semibold">{group.name}</h3>
                            <p className="text-sm text-gray-600">slug: {group.slug}</p>
                            <p className="text-sm text-gray-500">创建者: {group.creatorId}</p>
                        </div>
                        <div className="flex gap-2">
                            <span className={`px-2 py-1 text-xs rounded ${group.isPublic ? 'bg-green-100' : 'bg-gray-100'}`}>
                                {group.isPublic ? '公开' : '私密'}
                            </span>
                            <button 
                                onClick={() => handleDelete(group.id)}
                                disabled={deletingId === group.id}
                                className="text-red-600 text-sm disabled:opacity-50"
                            >
                                {deletingId === group.id ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}