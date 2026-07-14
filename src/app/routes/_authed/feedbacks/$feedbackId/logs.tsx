import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbackStatusLogsFn } from '~/functions'
import { Button, Card, EmptyState, Icon, SectionHeader, formatDateTime } from '@/components/coeer'
import { FeedbackStatusBadge } from '../-feedback-ui'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId/logs')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ params, deps: { search } }) => {
        const pageSize = 5

        const result = await getFeedbackStatusLogsFn({
            data: {
                feedbackId: params.feedbackId,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            logs: result?.items || [],
            total: result?.total || 0,
            pageSize,
        }
    },
    component: FeedbackLogsPage,
})

function FeedbackLogsPage() {
    const { logs, total, pageSize } = Route.useLoaderData()
    const { feedbackId } = Route.useParams()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="space-y-6">
            <SectionHeader
                title="处理记录"
                description="查看这条反馈的审核和处理状态流转。"
                action={
                    <Link to="/feedbacks/$feedbackId" params={{ feedbackId }}>
                        <Button variant="outline"><Icon name="chevron" className="h-4 w-4 rotate-180" /> 返回详情</Button>
                    </Link>
                }
            />

            <Card className="p-5">
                {logs.length ? (
                    <div className="divide-y divide-[hsl(var(--border))]">
                        {logs.map((log) => (
                            <div key={log.id} className="py-4 first:pt-0 last:pb-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <FeedbackStatusBadge status={log.status} />
                                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDateTime(log.createdAt)}</span>
                                </div>
                                {log.note ? <p className="mt-3 text-sm leading-6">{log.note}</p> : null}
                                {log.changedBy ? (
                                    <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">操作人：{log.changedBy.name}</p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState title="暂无处理记录" description="状态发生变化后会在这里显示。" />
                )}
            </Card>

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => navigate({ to: '/feedbacks/$feedbackId/logs', params: { feedbackId }, search: { page: page - 1 } })}
                    >
                        上一页
                    </Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button
                        variant="outline"
                        disabled={page >= totalPages}
                        onClick={() => navigate({ to: '/feedbacks/$feedbackId/logs', params: { feedbackId }, search: { page: page + 1 } })}
                    >
                        下一页
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
