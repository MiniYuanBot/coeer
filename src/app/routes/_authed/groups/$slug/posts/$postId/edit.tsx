import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { updateGroupPostFn } from '~/functions'
import { Badge, Button, Card, SectionHeader } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/posts/$postId/edit')({
    component: EditPostPage,
})

function EditPostPage() {
    const { group, post } = Route.useRouteContext()
    const { slug, postId } = Route.useParams()
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        const formData = new FormData(e.currentTarget)

        try {
            await updateGroupPostFn({
                data: {
                    id: postId,
                    title: formData.get('title') as string,
                    content: formData.get('content') as string,
                },
            })
            navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId } })
        } catch (err) {
            setError(err instanceof Error ? err.message : '保存失败')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <SectionHeader title="编辑帖子" description={`更新 ${group.name} 中的帖子内容。`} />

            <Card className="rounded-xl p-5">
                {error ? <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">{error}</div> : null}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <span className="text-sm font-medium">帖子类型</span>
                        <div className="mt-2"><Badge>{post.type === 'announcement' ? '公告' : '讨论'}</Badge></div>
                    </div>

                    <label className="block">
                        <span className="text-sm font-medium">标题</span>
                        <input name="title" required maxLength={200} defaultValue={post.title} className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm" />
                    </label>

                    <label className="block">
                        <span className="text-sm font-medium">内容</span>
                        <textarea name="content" required rows={10} maxLength={10000} defaultValue={post.content} className="coeer-focus mt-2 w-full resize-y rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-3 text-sm leading-6" />
                    </label>

                    <div className="flex flex-wrap justify-end gap-3 border-t border-[hsl(var(--border))] pt-4">
                        <Button type="button" variant="outline" onClick={() => navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId } })}>取消</Button>
                        <Button type="submit" loading={isSubmitting}>保存修改</Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}
