import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { joinGroupFn } from '~/functions'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/groups/$slug/')({
    component: GroupHomePage,
})

function GroupHomePage() {
    const { group, isMember } = Route.useRouteContext()
    const navigate = useNavigate()
    const [isJoining, setIsJoining] = useState(false)

    const handleJoin = async () => {
        setIsJoining(true)
        try {
            await joinGroupFn({ data: { groupId: group.id } })
            // refresh
            navigate({
                to: '/groups/$slug',
                params: { slug: group.slug },
            })
        } finally {
            setIsJoining(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">关于群组</h2>
                <p className="text-gray-600 whitespace-pre-wrap">
                    {group.description || '暂无描述'}
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">管理员</h2>
                    <Link
                        to="/groups/$slug/members"
                        params={{ slug: group.slug }}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        查看全部成员
                    </Link>
                </div>
                <div className="flex items-center gap-3">
                    {/* {group.creator.avatarUrl ? (
                        <img
                            src={group.creator.avatarUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                            {group.creator.name?.[0] || '?'}
                        </div>
                    )} */}
                    <span className="font-medium text-gray-900">{group.creator?.name || '未知用户'}</span>
                </div>
            </div>

            {!isMember && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                    <p className="text-blue-900 mb-4">加入这个群组，参与讨论</p>
                    <button
                        onClick={handleJoin}
                        disabled={isJoining}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isJoining ? '申请中...' : '申请加入'}
                    </button>
                </div>
            )}
        </div>
    )
}