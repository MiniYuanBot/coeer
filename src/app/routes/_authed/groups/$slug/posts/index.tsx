import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { deleteGroupPostFn, listPostsByGroupFn, togglePinPostFn } from '~/functions'
import { type GroupPostWithAuthor, GroupPostFilterSchema } from '@shared/contracts'
import { GroupPostType } from '@shared/constants'
import { Badge, Button, Card, EmptyState, FilterPanel, Icon, Modal, SectionHeader, formatDate } from '@/components/coeer'

const searchSchema = z.object({
    ...GroupPostFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/$slug/posts/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, deps: { search } }) => {
        const group = context.group!
        const pageSize = 5
        const posts = await listPostsByGroupFn({
            data: {
                groupId: group.id,
                type: search.type,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })

        return {
            posts: posts?.items || [],
            total: posts?.total || 0,
            page: search.page,
            pageSize,
            type: search.type,
        }
    },
    component: PostsListPage,
})

function postTypeLabel(type: string) {
    return type === 'announcement' ? '公告' : '讨论'
}

function PostsListPage() {
    const { posts, total, page, pageSize, type } = Route.useLoaderData()
    const { isAdmin } = Route.useRouteContext()
    const navigate = useNavigate()
    const { slug } = Route.useParams()
    const [deletingPost, setDeletingPost] = useState<GroupPostWithAuthor | null>(null)
    const totalPages = Math.ceil(total / pageSize)

    const go = (next: { type?: GroupPostType; page?: number }) => {
        navigate({ to: '/groups/$slug/posts', params: { slug }, search: { type, page: 1, ...next } })
    }

    const handleDelete = async (postId: string) => {
        await deleteGroupPostFn({ data: { id: postId } })
        setDeletingPost(null)
        navigate({ to: '/groups/$slug/posts', params: { slug }, search: { type, page } })
    }

    const handleTogglePin = async (postId: string, isPinned: boolean) => {
        await togglePinPostFn({ data: { id: postId, isPinned } })
        navigate({ to: '/groups/$slug/posts', params: { slug }, search: { type, page } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="帖子"
                description="查看群组讨论与公告。"
                action={<Link to="/groups/$slug/posts/create" params={{ slug }}><Button><Icon name="send" /> 发布帖子</Button></Link>}
            />

            <FilterPanel
                searchPlaceholder="帖子页暂不支持搜索"
                onSearch={() => undefined}
                groups={[
                    {
                        items: [
                            { key: 'all', label: `全部 ${total}`, active: !type, onClick: () => go({ type: undefined }) },
                            { key: 'discussion', label: '讨论', active: type === 'discussion', onClick: () => go({ type: 'discussion' }) },
                            { key: 'announcement', label: '公告', active: type === 'announcement', onClick: () => go({ type: 'announcement' }) },
                        ],
                    },
                ]}
            />

            {posts.length ? (
                <div className="space-y-4">
                    {posts.map((post) => (
                        <Card key={post.id} className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    {post.isPinned ? <Badge tone="primary">置顶</Badge> : null}
                                    <Badge>{postTypeLabel(post.type)}</Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {isAdmin ? (
                                        <Button size="sm" variant="ghost" onClick={() => handleTogglePin(post.id, !post.isPinned)}>
                                            {post.isPinned ? '取消置顶' : '置顶'}
                                        </Button>
                                    ) : null}
                                    <Link to="/groups/$slug/posts/$postId/edit" params={{ slug, postId: post.id }}>
                                        <Button size="sm" variant="outline">编辑</Button>
                                    </Link>
                                    <Button size="sm" variant="danger" onClick={() => setDeletingPost(post)}>删除</Button>
                                </div>
                            </div>

                            <Link to="/groups/$slug/posts/$postId" params={{ slug, postId: post.id }} className="mt-4 block">
                                <h3 className="text-[15px] font-medium hover:text-[hsl(var(--primary))]">{post.title}</h3>
                            </Link>
                            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                                {post.content.replace(/[#*`]/g, '')}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                                <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-xs font-medium text-[hsl(var(--primary))]">
                                    {(post.author?.name || '未知用户').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-[hsl(var(--foreground))]">{post.author?.name || '未知用户'}</span>
                                <span>{formatDate(post.createdAt)}</span>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <EmptyState
                    title="暂无帖子"
                    description="发布第一条讨论或公告，开启群组协作。"
                    action={<Link to="/groups/$slug/posts/create" params={{ slug }}><Button>发布帖子</Button></Link>}
                />
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => go({ page: page + 1 })}>下一页</Button>
                </div>
            ) : null}

            <Modal open={Boolean(deletingPost)} title="删除帖子" onOpenChange={(open) => !open && setDeletingPost(null)}>
                <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                    确定删除“{deletingPost?.title}”吗？此操作不可撤销。
                </p>
                <div className="mt-5 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setDeletingPost(null)}>取消</Button>
                    <Button variant="danger" onClick={() => deletingPost && handleDelete(deletingPost.id)}>删除</Button>
                </div>
            </Modal>
        </div>
    )
}
