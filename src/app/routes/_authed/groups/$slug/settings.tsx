import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { updateGroupFn, deleteGroupFn } from '~/functions'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/groups/$slug/settings')({
    component: GroupSettingsPage,
})

function GroupSettingsPage() {
    const { group } = Route.useRouteContext()
    const navigate = useNavigate()
    const { slug } = Route.useParams()

    const [updateLoading, setUpdateLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setUpdateLoading(true)

        const formData = new FormData(e.currentTarget)

        try {
            await updateGroupFn({
                data: {
                    id: formData.get('id') as string,
                    name: formData.get('name') as string,
                    description: formData.get('description') as string,
                    // avatarUrl: formData.get('avatarUrl') as string,
                    isPublic: formData.get('isPublic') === 'on',
                },
            })

            // Refresh
            navigate({
                to: '/groups/$slug/settings',
                params: { slug },
            })
        } finally {
            setUpdateLoading(false)
        }
    }

    const handleDelete = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!confirm('确定要删除这个群组吗？所有数据将被永久删除！')) {
            return
        }

        setDeleteLoading(true)

        try {
            await deleteGroupFn({ data: { id: group.id } })
            navigate({ to: '/groups/my' })
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-8">
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">群组设置</h2>

                <form onSubmit={handleUpdate} className="space-y-6">
                    <input type="hidden" name="id" value={group.id} />

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            群组名称
                        </label>
                        <input
                            type="text"
                            name="name"
                            defaultValue={group.name}
                            required
                            disabled={updateLoading}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    {/* <div>
                        <label className="block text-sm font-medium text-gray-700">
                            头像 URL
                        </label>
                        <input
                            type="url"
                            name="avatarUrl"
                            defaultValue={group.avatarUrl || ''}
                            disabled={updateLoading}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                    </div> */}

                    <div>
                        <label className="block text-sm font-medium text-gray-700">
                            描述
                        </label>
                        <textarea
                            name="description"
                            rows={4}
                            defaultValue={group.description || ''}
                            disabled={updateLoading}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="isPublic"
                            id="isPublic"
                            defaultChecked={group.isPublic}
                            disabled={updateLoading}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                        />
                        <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                            公开群组
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={updateLoading}
                            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {updateLoading ? '保存中...' : '保存设置'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-red-200">
                <h2 className="text-lg font-semibold text-red-600 mb-4">危险区域</h2>
                <p className="text-sm text-gray-600 mb-4">
                    删除群组将永久移除所有数据和内容，此操作不可撤销。
                </p>
                <form onSubmit={handleDelete}>
                    <button
                        type="submit"
                        disabled={deleteLoading}
                        className="px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                        {deleteLoading ? '删除中...' : '删除群组'}
                    </button>
                </form>
            </div>
        </div>
    )
}