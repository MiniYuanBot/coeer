import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, SectionHeader, bulletinTypeLabels, formatDateTime } from '@/components/coeer'
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
        <article className="mx-auto max-w-3xl space-y-6">
            <SectionHeader title={bulletin.title} description={formatDateTime(bulletin.createdAt)} />
            <Card className="rounded-xl p-5">
                <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletinTypeLabels[bulletin.type] || bulletin.type}</Badge>
                <p className="mt-5 whitespace-pre-wrap text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{bulletin.content}</p>
            </Card>
        </article>
    )
}
