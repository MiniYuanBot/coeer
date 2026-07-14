import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { useState } from 'react'
import { getFeedbacksFn, updateFeedbackStatusFn } from '~/functions'
import { Button, Card, EmptyState, Icon, SectionHeader, formatDateTime } from '@/components/coeer'
import { feedbackTargetLabels } from '../../feedbacks/-feedback-ui'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/feedbacks/pending')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 6
        const result = await getFeedbacksFn({
            data: {
                status: 'pending',
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            feedbacks: result?.items || [],
            total: result?.total || 0,
            pageSize,
        }
    },
    component: AdminPendingFeedbacksPage,
})

function AdminPendingFeedbacksPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()
    const [processingId, setProcessingId] = useState<string | null>(null)
    const totalPages = Math.ceil(total / pageSize)

    const review = async (id: string, status: 'processing' | 'invalid', note: string) => {
        setProcessingId(id)
        try {
            await updateFeedbackStatusFn({ data: { id, status, note } })
            navigate({ to: '/admin/feedbacks/pending', search: { page } })
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="待审核反馈"
                description="通过后反馈会在用户反馈列表中公开；驳回后仅提交者和管理员可见。"
                action={
                    <Link to="/admin/feedbacks">
                        <Button variant="outline"><Icon name="feedback" /> 全部反馈</Button>
                    </Link>
                }
            />

            <Card className="p-4">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                    当前有 <span className="font-semibold text-[hsl(var(--foreground))]">{total}</span> 条反馈等待审核。
                </p>
            </Card>

            {feedbacks.length ? (
                <div className="grid gap-4">
                    {feedbacks.map((feedback) => (
                        <Card key={feedback.id} className="p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                                        <span>{feedbackTargetLabels[feedback.targetType]}</span>
                                        <span>{formatDateTime(feedback.createdAt)}</span>
                                        <span>{feedback.isAnonymous ? '匿名提交' : feedback.author?.name || '未知用户'}</span>
                                    </div>
                                    <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="mt-2 block text-lg font-semibold hover:text-[hsl(var(--primary))]">
                                        {feedback.title}
                                    </Link>
                                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{feedback.content}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button
                                        loading={processingId === feedback.id}
                                        onClick={() => review(feedback.id, 'processing', '管理员审核通过，反馈已公开并进入处理。')}
                                    >
                                        <Icon name="check" /> 同意公开
                                    </Button>
                                    <Button
                                        variant="outline"
                                        loading={processingId === feedback.id}
                                        onClick={() => review(feedback.id, 'invalid', '管理员审核后驳回为无效反馈。')}
                                    >
                                        驳回
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card className="p-8">
                    <EmptyState title="暂无待审核反馈" description="新的反馈提交后会出现在这里。" />
                </Card>
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/admin/feedbacks/pending', search: { page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/admin/feedbacks/pending', search: { page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
