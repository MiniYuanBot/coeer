import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { BulletinCard, EmptyState, FilterPanel, SectionHeader, bulletinTypeLabels } from '@/components/coeer'
import { getBulletinFeedFn } from '~/functions'
import { BULLETIN_TYPE_ARRAY, BulletinType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    search: z.string().optional(),
    page: z.number().default(1),
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
    const { type, search } = Route.useSearch()
    const navigate = useNavigate()

    const go = (next: { type?: string; search?: string; page?: number }) => {
        navigate({ to: '/bulletins', search: { type, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="公告" description="聚合官方通知、群组公告和活动提醒。" />
            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索公告标题或内容"
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '类型',
                        items: [
                            { key: 'all', label: `全部 ${total}`, active: !type, onClick: () => go({ type: undefined }) },
                            ...BULLETIN_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: bulletinTypeLabels[item],
                                active: type === item,
                                onClick: () => go({ type: item as BulletinType }),
                            })),
                        ],
                    },
                ]}
            />
            {bulletins.length ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {bulletins.map((bulletin: any) => <BulletinCard key={bulletin.id} bulletin={bulletin} />)}
                </div>
            ) : (
                <EmptyState title="暂无公告" description="公告会在这里集中展示。" />
            )}
        </div>
    )
}
