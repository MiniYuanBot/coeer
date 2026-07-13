import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { Badge, BulletinCard, Card, EmptyState, SectionHeader } from '@/components/coeer'
import { getBulletinFeedFn } from '~/functions'

const searchSchema = z.object({
    type: z.string().optional(),
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

    return (
        <div className="space-y-6">
            <SectionHeader title="公告" description="聚合官方通知、群组公告和活动提醒。" />
            <Card className="flex flex-wrap items-center gap-2 p-4">
                <Badge tone="primary">全部 {total}</Badge>
                <Badge>官方</Badge>
                <Badge>群组</Badge>
                <Badge>活动</Badge>
            </Card>
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
