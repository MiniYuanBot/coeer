import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { deleteFeedbackFn, getFeedbackByIdFn } from '~/functions'
import { Badge, Button, Card, DetailLayout, Icon, formatDateTime } from '@/components/coeer'
import { FeedbackStatusBadge, feedbackTargetLabels } from '../-feedback-ui'

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId/')({
    loader: async ({ params, context }) => {
        const result = await getFeedbackByIdFn({
            data: { id: params.feedbackId },
        })
        if (!result) {
            throw new Error('Feedback not found')
        }
        return {
            feedback: result,
            currentUser: context.user,
        }
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Feedback not found') {
            throw redirect({ to: '/feedbacks' })
        }

        throw error
    },
    component: FeedbackDetailPage,
})

function FeedbackDetailPage() {
    const { feedback, currentUser } = Route.useLoaderData()
    const navigate = useNavigate()
    const [isDeleting, setIsDeleting] = useState(false)
    const canDelete = currentUser?.role === 'admin' || feedback.authorId === currentUser?.id

    const handleDelete = async () => {
        if (!confirm('确定删除这条反馈吗？')) return

        setIsDeleting(true)
        try {
            await deleteFeedbackFn({ data: { id: feedback.id } })
            navigate({ to: '/feedbacks' })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <PageLayout title={feedback.title}
            description="反馈详情、处理状态与流转记录。"
            action={
                    <div className="flex flex-wrap gap-2">
                        <Link to="/feedbacks/$feedbackId/logs" params={{ feedbackId: feedback.id }}>
                            <Button variant="outline"><Icon name="activity" /> 处理记录</Button>
                        </Link>
                        {canDelete ? (
                            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>
                                删除
                            </Button>
                        ) : null}
                    </div>
                }>

            <div className="coeer-mobile-status" aria-label="当前反馈状态">
                <FeedbackStatusBadge status={feedback.status} />
                <Badge>{feedbackTargetLabels[feedback.targetType]}</Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(feedback.createdAt)}</span>
            </div>

            <DetailLayout asideLabel="反馈信息" aside={
                <Card className="space-y-5 p-5">
                    <h2 className="text-sm font-semibold">反馈信息</h2>
                    <dl className="space-y-4 text-[13px]">
                        <div><dt className="mb-2 text-xs text-muted-foreground">处理状态</dt><dd><FeedbackStatusBadge status={feedback.status} /></dd></div>
                        <div><dt className="mb-2 text-xs text-muted-foreground">反馈对象</dt><dd><Badge>{feedbackTargetLabels[feedback.targetType]}</Badge></dd></div>
                        <div><dt className="mb-2 text-xs text-muted-foreground">提交时间</dt><dd className="tabular-nums">{formatDateTime(feedback.createdAt)}</dd></div>
                    </dl>
                    <div className="flex min-w-0 items-center gap-3 border-t border-border pt-5">
                        <div aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-medium text-primary">
                            {feedback.isAnonymous ? '匿' : feedback.author?.name?.[0] || 'U'}
                        </div>
                        <div className="min-w-0">
                            <p className="break-words text-sm font-medium">{feedback.isAnonymous ? '匿名用户' : feedback.author?.name || '未知用户'}</p>
                            <p className="mt-1 text-xs text-muted-foreground">提交人</p>
                        </div>
                    </div>
                </Card>
            }>
                <Card className="space-y-4 p-5">
                    <h2 className="text-sm font-semibold">反馈内容</h2>
                    {feedback.targetDesc ? <p className="text-sm text-muted-foreground">关联对象：{feedback.targetDesc}</p> : null}
                    <Markdown content={feedback.content} className="max-w-[76ch] text-foreground" />
                </Card>
            </DetailLayout>
        </PageLayout>
    )
}
import { Markdown } from '@/components/coeer/ui/Markdown'
