import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, SectionHeader, formatDateTime } from '@/components/coeer'
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
            <Card className="p-6">
                <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletin.type}</Badge>
                <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--muted-foreground))]">{bulletin.content}</p>
            </Card>
        </article>
    )
}
