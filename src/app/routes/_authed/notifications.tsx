import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { listNotificationsFn, markNotificationReadFn } from '~/functions/notifications'
import { Alert, Badge, Button, Card, EmptyState, PageLayout, SectionHeader, formatDateTime } from '@/components/coeer'

export const Route = createFileRoute('/_authed/notifications')({ component: NotificationsPage })

function NotificationsPage() {
    const { user } = Route.useRouteContext()
    const [unreadOnly, setUnreadOnly] = useState(false)
    const [page, setPage] = useState(1)
    const client = useQueryClient()
    const result = useQuery({ queryKey: ['notifications', user!.id, unreadOnly, page], queryFn: () => listNotificationsFn({ data: { limit: 20, offset: (page - 1) * 20, unreadOnly } }), refetchInterval: 30000 })
    const read = useMutation({ mutationFn: (id?: string) => markNotificationReadFn({ data: { id } }), onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }) })
    return <PageLayout>
        <SectionHeader title="站内通知" description="反馈处理、审核结果和活动报名的最新消息。" action={<Button variant="outline" loading={read.isPending} disabled={!result.data?.unread} onClick={() => read.mutate(undefined)}>全部标为已读</Button>} />
        <div className="my-5 flex gap-2"><Button variant={!unreadOnly ? 'primary' : 'ghost'} onClick={() => { setUnreadOnly(false); setPage(1) }}>全部</Button><Button variant={unreadOnly ? 'primary' : 'ghost'} onClick={() => { setUnreadOnly(true); setPage(1) }}>未读 {result.data?.unread ?? 0}</Button></div>
        {result.error || read.error ? <Alert tone="danger">{(result.error || read.error)?.message}</Alert> : null}
        {result.isPending ? <p role="status">正在加载通知…</p> : result.data?.items.length ? <div className="space-y-3">{result.data.items.map((item) => <Card key={item.id} className="p-5">
            <div className="flex items-start justify-between gap-3"><h2 className="text-sm font-medium">{item.title} {!item.readAt ? <Badge tone="primary">未读</Badge> : null}</h2><time className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</time></div>
            <p className="my-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.content}</p>
            <div className="flex gap-2"><Button asChild size="sm" variant="outline"><Link to={item.href as any} onClick={() => read.mutate(item.id)}>查看详情</Link></Button>{!item.readAt ? <Button size="sm" variant="ghost" loading={read.isPending} onClick={() => read.mutate(item.id)}>标为已读</Button> : null}</div>
        </Card>)}</div> : !result.error ? <EmptyState title={unreadOnly ? '没有未读通知' : '暂无通知'} description="有新的处理进展时，会在这里通知你。" /> : null}
        {(result.data?.total ?? 0) > 20 ? <div className="mt-5 flex items-center justify-center gap-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button><span className="text-sm">第 {page} 页</span><Button variant="outline" disabled={page * 20 >= (result.data?.total ?? 0)} onClick={() => setPage(page + 1)}>下一页</Button></div> : null}
    </PageLayout>
}
