// routes/_authed/groups/$slug.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { getGroupBySlugFn, joinGroupFn, leaveGroupFn, getGroupMembersFn } from '~/functions/groups'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/groups/$slug')({
    component: GroupDetailComponent,
    loader: async ({ params }) => {
        try {
            const group = await getGroupBySlugFn({ data: { slug: params.slug } })
            if (!group) {
                throw new Error('Group not found')
            }
            const members = await getGroupMembersFn({
                data: { groupId: group.id, pageSize: 10 }
            }).catch(() => null)

            return { group, members: members?.items ?? [] }

        } catch (error) {
            throw new Error('Group not found')
        }
    },
})

function GroupDetailComponent() {
    const { group, members } = Route.useLoaderData()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleJoin = async () => {
        setLoading(true)
        try {
            await joinGroupFn({ data: { groupId: group.id } })
            window.location.reload() // 简单刷新
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败')
        } finally {
            setLoading(false)
        }
    }

    const handleLeave = async () => {
        if (!confirm('确定要退出这个群组吗？')) return
        setLoading(true)
        try {
            await leaveGroupFn({ data: { groupId: group.id } })
            window.location.reload()
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失败')
        } finally {
            setLoading(false)
        }
    }

    // 检查是否已加入（简化版）
    const isJoined = false // 实际应该从membership状态判断

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                    {/* <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-2xl text-gray-500">
                        {group.avatarUrl ? (
                            <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                            group.name[0]
                        )}
                    </div> */}
                    <div>
                        <h1 className="text-2xl font-bold">{group.name}</h1>
                        <div className="flex items-center space-x-2 mt-1">
                            <span className="text-sm px-2 py-1 bg-gray-100 rounded">
                                {group.category}
                            </span>
                            <span className="text-sm text-gray-600">
                                {group.memberCount} 名成员 · {group.postCount} 个帖子
                            </span>
                        </div>
                        <p className="text-gray-600 mt-2">{group.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                            创建者: {group.creator?.name} · 创建于 {new Date(group.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="space-x-2">
                    {isJoined ? (
                        <button
                            onClick={handleLeave}
                            disabled={loading}
                            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                        >
                            退出群组
                        </button>
                    ) : (
                        <button
                            onClick={handleJoin}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            加入群组
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Members Section */}
            <div className="border-t pt-6">
                <h2 className="text-xl font-semibold mb-4">成员</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center space-x-3">
                            {/* <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm">
                                {member.user.avatarUrl ? (
                                    <img src={member.user.avatarUrl} className="w-full h-full rounded-full" />
                                ) : (
                                    member.user.name[0]
                                )}
                            </div> */}
                            <div>
                                <p className="text-sm font-medium">{member.user.name}</p>
                                <p className="text-xs text-gray-500">{member.role}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}