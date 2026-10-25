import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { BulletinCard, EmptyState, Pagination, bulletinTypeLabels } from '@/components/coeer'
import { getBulletinFeedFn } from '~/functions'
import { BULLETIN_TYPE_ARRAY, BulletinType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/bulletins/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const result = await getBulletinFeedFn({
            data: {
                type: search.type as any,
                search: search.search,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return { bulletins: result.data?.items ?? [], total: result.data?.total ?? 0 }
    },
    component: BulletinsPage,
})

function BulletinsPage() {
    const { bulletins, total } = Route.useLoaderData()
    const { type, search, page } = Route.useSearch()
    const navigate = Route.useNavigate()

    const go = (next: { type?: string; search?: string; page?: number }) => {
        navigate({ to: '/bulletins', search: previous => ({ ...previous, page: 1, ...next }) })
    }

    return (
        <PageLayout title="公告"
            scope={{ title: '公告范围', items: [{ key: 'all', label: '全部公告', active: true, onClick: () => go({ page: 1 }) }] }}
            description="聚合官方通知、群组公告和活动提醒。"
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索公告标题或内容",
                onSearch: (value) => go({ search: value || undefined }),
                onClear: () => go({ search: undefined, type: undefined }),
                groups: [
                    {
                        title: '类型',
                        items: [
                            { key: 'all', label: '全部', active: !type, onClick: () => go({ type: undefined }) },
                            ...BULLETIN_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: bulletinTypeLabels[item],
                                active: type === item,
                                onClick: () => go({ type: item as BulletinType }),
                            })),
                        ],
                    },
                ]
            }}>

            {bulletins.length ? (
                <div className="coeer-bulletin-list">
                    {bulletins.map((bulletin: any) => <BulletinCard key={bulletin.id} bulletin={bulletin} />)}
                </div>
            ) : (
                <EmptyState title="暂无公告" description="公告会在这里集中展示。" />
            )}
            <Pagination total={total} page={page} size={9} onChange={(page) => go({ page })} />
        </PageLayout>
    )
}
