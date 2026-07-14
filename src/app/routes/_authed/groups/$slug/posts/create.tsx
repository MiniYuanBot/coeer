import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createGroupPostFn } from '~/functions'
import type { GroupPostType } from '@shared/constants'
import { Badge, Button, Card, Icon, SectionHeader } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/posts/create')({
    component: CreatePostPage,
})

function CreatePostPage() {
    const { group } = Route.useRouteContext()
    const { slug } = Route.useParams()
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        const formData = new FormData(e.currentTarget)

        try {
            await createGroupPostFn({
                data: {
                    groupId: group.id,
                    type: formData.get('type') as GroupPostType,
                    title: formData.get('title') as string,
                    content: formData.get('content') as string,
                },
            })
            navigate({ to: '/groups/$slug/posts', params: { slug } })
        } catch (err) {
            setError(err instanceof Error ? err.message : '发布失败')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <SectionHeader title="发布帖子" description={`分享内容到 ${group.name}。`} />

            <Card className="rounded-xl p-5">
                {error ? <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div> : null}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-2 block text-sm font-medium">帖子类型</label>
                        <div className="flex flex-wrap gap-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input type="radio" name="type" value="discussion" defaultChecked className="h-4 w-4 accent-[hsl(var(--primary))]" />
                                讨论
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input type="radio" name="type" value="announcement" className="h-4 w-4 accent-[hsl(var(--primary))]" />
                                公告
                                <Badge>管理员</Badge>
                            </label>
                        </div>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium">标题</span>
                        <input name="title" required maxLength={200} placeholder="一句话说明帖子主题" className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium">内容</span>
                        <textarea name="content" required rows={10} maxLength={10000} placeholder="写下正文内容" className="coeer-focus mt-2 w-full resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm leading-6" />
                    </label>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] pt-4">
                        <Button type="button" variant="outline" onClick={() => navigate({ to: '/groups/$slug/posts', params: { slug } })}>取消</Button>
                        <Button type="submit" loading={isSubmitting}><Icon name="send" /> 发布帖子</Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
