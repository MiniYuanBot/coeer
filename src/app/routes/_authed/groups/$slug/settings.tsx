import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { updateGroupFn, deleteGroupFn } from '~/functions'
import { useState } from 'react'
import { Button, Card, SectionHeader } from '@/components/coeer'

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
            await deleteGroupFn({ data: { groupId: group.id } })
            navigate({ to: '/groups/my' })
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div className="max-w-2xl space-y-6">
            <SectionHeader title="群组设置" description="更新群组展示信息和可见性。" />
            <Card className="rounded-xl p-5">

                <form onSubmit={handleUpdate} className="space-y-6">
                    <input type="hidden" name="id" value={group.id} />

                    <div>
                        <label className="block text-sm font-medium">
                            群组名称
                        </label>
                        <input
                            type="text"
                            name="name"
                            defaultValue={group.name}
                            required
                            disabled={updateLoading}
                            className="coeer-focus mt-2 block h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm disabled:opacity-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            描述
                        </label>
                        <textarea
                            name="description"
                            rows={4}
                            defaultValue={group.description || ''}
                            disabled={updateLoading}
                            className="coeer-focus mt-2 block w-full resize-none rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm leading-6 disabled:opacity-50"
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="isPublic"
                            id="isPublic"
                            defaultChecked={group.isPublic}
                            disabled={updateLoading}
                            className="h-4 w-4 rounded border-[hsl(var(--border))] accent-[hsl(var(--primary))] disabled:opacity-50"
                        />
                        <label htmlFor="isPublic" className="ml-2 block text-sm">
                            公开群组
                        </label>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            loading={updateLoading}
                        >
                            保存设置
                        </Button>
                    </div>
                </form>
            </Card>

            <Card className="rounded-xl border-rose-500/20 p-5">
                <h2 className="mb-4 text-[15px] font-medium text-rose-600 dark:text-rose-400">危险区域</h2>
                <p className="mb-4 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    删除群组将永久移除所有数据和内容，此操作不可撤销。
                </p>
                <form onSubmit={handleDelete}>
                    <Button
                        type="submit"
                        variant="danger"
                        loading={deleteLoading}
                    >
                        删除群组
                    </Button>
                </form>
            </Card>
        </div>
    )
}
