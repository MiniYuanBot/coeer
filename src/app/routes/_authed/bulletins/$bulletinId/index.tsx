import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, PageLayout, bulletinTypeLabels, formatDateTime } from '@/components/coeer'
import { getBulletinByIdFn } from '~/functions'

export const Route = createFileRoute('/_authed/bulletins/$bulletinId/')({
    loader: async ({ params }) => {
        const result = await getBulletinByIdFn({ data: { id: params.bulletinId } })
        return { bulletin: result.data }
    },
    component: BulletinDetailPage,
})

function BulletinDetailPage() {
    const { bulletin } = Route.useLoaderData()
    if (!bulletin) return <EmptyState title="公告不存在" />

    return (
        <PageLayout as="article" title={bulletin.title} description={formatDateTime(bulletin.createdAt)}>
            <Card className="rounded-lg p-5">
                <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletinTypeLabels[bulletin.type] || bulletin.type}</Badge>
                <Markdown content={bulletin.content} className="mt-5 text-foreground" />
            </Card>
        </PageLayout>
    )
}
import { Markdown } from '@/components/coeer/ui/Markdown'
