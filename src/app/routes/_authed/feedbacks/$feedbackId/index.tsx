import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { deleteFeedbackFn, getFeedbackByIdFn } from '~/functions'
import { Badge, Button, Card, Icon, SectionHeader, formatDateTime } from '@/components/coeer'
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
    const canDelete = currentUser?.role === 'admin' || currentUser?.email === feedback.author?.email

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
        <div className="space-y-6">
            <SectionHeader
                title={feedback.title}
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
                }
            />

            <Card className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <FeedbackStatusBadge status={feedback.status} />
                    <Badge>{feedbackTargetLabels[feedback.targetType]}</Badge>
                    {feedback.isAnonymous ? <Badge>匿名提交</Badge> : null}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDateTime(feedback.createdAt)}</span>
                </div>

                {feedback.targetDesc ? (
                    <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
                        关联对象：{feedback.targetDesc}
                    </p>
                ) : null}

                <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--foreground))]">
                    {feedback.content}
                </div>
            </Card>

            <Card className="p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
                        {feedback.isAnonymous ? '匿' : feedback.author?.name?.[0] || 'U'}
                    </div>
                    <div>
                        <p className="text-[15px] font-medium">{feedback.isAnonymous ? '匿名用户' : feedback.author?.name || '未知用户'}</p>
                        <p className="text-[13px] text-[hsl(var(--muted-foreground))]">提交人</p>
                    </div>
                </div>
            </Card>
        </div>
    )
}
