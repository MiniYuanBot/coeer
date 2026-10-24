import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { listPostsByGroupFn } from '~/functions'
import { GroupPostFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, Icon, Pagination, SectionHeader, formatDate } from '@/components/coeer'

const searchSchema = z.object({
    ...GroupPostFilterSchema.shape,
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/groups/$slug/posts/announcements')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, params, deps: { search } }) => {
        const group = context.group!
        const pageSize = 5
        const result = await listPostsByGroupFn({
            data: {
                groupId: group.id,
                type: 'announcement',
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        if (!result) {
            throw redirect({ to: '/groups/$slug/posts', params: { slug: params.slug } })
        }
        return { group, announcements: result.items || [], total: result.total ?? 0, pageSize }
    },
    component: AnnouncementsPage,
})

function AnnouncementsPage() {
    const { group, announcements, total, pageSize } = Route.useLoaderData()
    const { slug } = Route.useParams()
    const { page } = Route.useSearch()
    const navigate = useNavigate()

    return (
        <div className="space-y-6">
            <SectionHeader level="h2"
                title="群组公告"
                description={`${group.name} 的正式通知。`}
                action={<Link to="/groups/$slug/posts" params={{ slug }}><Button variant="outline"><Icon name="chevron" className="h-4 w-4 rotate-180" /> 全部帖子</Button></Link>}
            />

            {announcements.length ? (
                <div className="space-y-4">
                    {announcements.map((post) => (
                        <Card key={post.id} className="rounded-lg p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone="primary">公告</Badge>
                                {post.isPinned ? <Badge>置顶</Badge> : null}
                                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
                            </div>
                            <Link to="/groups/$slug/posts/$postId" params={{ slug, postId: post.id }} className="mt-3 block">
                                <h3 className="text-[15px] font-medium hover:text-[hsl(var(--primary))]">{post.title}</h3>
                            </Link>
                            <PostContent content={post.content} className="mt-2 text-muted-foreground" />
                            <div className="mt-4 flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-xs font-medium text-[hsl(var(--primary))]">
                                    {(post.author?.name || '未知用户').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-[hsl(var(--foreground))]">{post.author?.name || '未知用户'}</span>
                            </div>
                            <div className="mt-3 flex gap-2"><PostLikeButton post={post} /><PostBookmarkButton post={post} /></div>
                        </Card>
                    ))}
                </div>
            ) : (
                <EmptyState title="暂无公告" description="群组公告发布后会显示在这里。" />
            )}
            <Pagination total={total} page={page} size={pageSize} onChange={(page) => void navigate({ to: '/groups/$slug/posts/announcements', params: { slug }, search: { page } })} />
        </div>
    )
}
import { PostContent } from '@/components/coeer/cards/PostContent'
import { PostLikeButton } from '@/components/coeer/cards/PostLikeButton'
import { PostBookmarkButton } from '@/components/coeer/cards/PostBookmarkButton'
