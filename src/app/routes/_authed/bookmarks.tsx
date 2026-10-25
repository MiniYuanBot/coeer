import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { listBookmarksFn } from '~/functions/bookmarks'
import { Button, EmptyState, FilterPanel, PageLayout, Pagination, PostCard, SectionHeader } from '@/components/coeer'
import { ListBookmarksSchema } from '@shared/contracts/bookmarks'
import { GROUP_POST_TYPE_ARRAY, type GroupPostType } from '@shared/constants/groupPosts'

const pageSize = 9
const typeLabels = { announcement: '公告', discussion: '讨论' }

export const Route = createFileRoute('/_authed/bookmarks')({
    validateSearch: ListBookmarksSchema.pick({ search: true, type: true }).extend({ page: z.coerce.number().int().min(1).catch(1).default(1) }),
    loaderDeps: ({ search }) => search,
    loader: async ({ deps: { page, search, type } }) => {
        const result = await listBookmarksFn({ data: { search, type, limit: pageSize, offset: (page - 1) * pageSize } })
        const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
        if (page > lastPage) throw redirect({ to: '/bookmarks', search: { search, type, page: lastPage }, replace: true })
        return result
    },
    component: BookmarksPage,
})

function BookmarksPage() {
    const { items, total } = Route.useLoaderData()
    const { page, search, type } = Route.useSearch()
    const navigate = Route.useNavigate()
    const go = (next: { page?: number; search?: string; type?: GroupPostType }) =>
        void navigate({ to: '/bookmarks', search: previous => ({ ...previous, page: 1, ...next }) })
    const filtered = !!search || !!type
    return <PageLayout>
        <SectionHeader title="我的收藏" description="按类型整理收藏的公告和讨论，随时搜索回看。" />
        <FilterPanel searchValue={search} searchPlaceholder="搜索收藏标题、正文或群组" onSearch={value => go({ search: value || undefined })}
            onClear={() => go({ search: undefined, type: undefined })} groups={[{ title: '类型', items: [
                { key: 'all', label: '全部', active: !type, onClick: () => go({ type: undefined }) },
                ...GROUP_POST_TYPE_ARRAY.map(value => ({ key: value, label: typeLabels[value], active: type === value, onClick: () => go({ type: value }) })),
            ] }]} />
        {items.length ? <section aria-label="收藏列表" className="space-y-3">{items.map(({ post, group, author }) =>
            <PostCard key={post.id} variant="bookmark" post={{ ...post, author, isBookmarked: true }} to={`/groups/${group.slug}/posts/${post.id}`}
                source={<Link to="/groups/$slug" params={{ slug: group.slug }} className="coeer-focus rounded hover:text-primary">{group.name}</Link>} />
        )}</section> : <EmptyState title={filtered ? '没有匹配的收藏' : '还没有收藏'}
            description={filtered ? '换个关键词或类型，或清除筛选查看全部收藏。' : '在动态或群组帖子中点击收藏，之后可以在这里回看。'}
            action={filtered ? <Button variant="secondary" onClick={() => go({ search: undefined, type: undefined })}>清除筛选</Button> : <Button asChild variant="secondary"><Link to="/">浏览动态</Link></Button>} />}
        <Pagination total={total} page={page} size={pageSize} onChange={page => go({ page })} />
    </PageLayout>
}
