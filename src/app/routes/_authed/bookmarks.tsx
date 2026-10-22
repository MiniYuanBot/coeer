import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { listBookmarksFn } from '~/functions/bookmarks'
import { Badge, Button, EmptyState, PageLayout, Pagination, PostCard, SectionHeader } from '@/components/coeer'

export const Route = createFileRoute('/_authed/bookmarks')({
    validateSearch: z.object({ page: z.coerce.number().int().min(1).catch(1).default(1) }),
    loaderDeps: ({ search }) => search,
    loader: ({ deps }) => listBookmarksFn({ data: { limit: 10, offset: (deps.page - 1) * 10 } }),
    component: BookmarksPage,
})

function BookmarksPage() {
    const { items, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    return <PageLayout>
        <SectionHeader title="我的收藏" description="收藏的帖子会保存在这里，方便随时回看。" />
        {items.length ? <div className="space-y-5">{items.map(({ post, group, author }) => <div key={post.id}>
            <Link to="/groups/$slug" params={{ slug: group.slug }} className="coeer-focus mb-2 inline-block rounded"><Badge>{group.name}</Badge></Link>
            <PostCard post={{ ...post, author, isBookmarked: true }} to={`/groups/${group.slug}/posts/${post.id}`} />
        </div>)}</div> : <EmptyState title={page > 1 ? '这一页没有收藏' : '还没有收藏'} description="在动态或群组帖子中点击收藏。"
            action={<Button asChild variant="secondary"><Link to="/">浏览动态</Link></Button>} />}
        {total > 10 || page > 1 ? <Pagination total={total} page={page} onChange={(next) => void navigate({ to: '/bookmarks', search: { page: next } })} /> : null}
    </PageLayout>
}
