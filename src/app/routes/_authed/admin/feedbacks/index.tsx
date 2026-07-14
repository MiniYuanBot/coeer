import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { deleteFeedbackFn, getFeedbacksFn, updateFeedbackStatusFn } from '~/functions'
import { FeedbackStatus } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, Icon, Modal, SearchInput, SectionHeader, formatDate } from '@/components/coeer'
import { FeedbackStatusBadge, feedbackTargetLabels } from '../../feedbacks/-feedback-ui'

const searchSchema = z.object({
    ...FeedbackFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/feedbacks/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 10
        const result = await getFeedbacksFn({
            data: {
                ...search,
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
    component: AdminFeedbacksPage,
})

function AdminFeedbacksPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const { status, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const router = useRouter()
    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [workingId, setWorkingId] = useState<string | null>(null)
    const totalPages = Math.ceil(total / pageSize)
    const isLoading = router.state.status === 'pending'

    const refresh = () => navigate({ to: '/admin/feedbacks', search: { status, search, page } })

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        navigate({ to: '/admin/feedbacks', search: { status, search: (formData.get('search') as string) || undefined, page: 1 } })
    }

    const handleReview = async (id: string, nextStatus: FeedbackStatus, isPublic: boolean, note?: string) => {
        setWorkingId(id)
        try {
            await updateFeedbackStatusFn({ data: { id, status: nextStatus, isPublic, note } })
            setReviewingId(null)
            refresh()
        } finally {
            setWorkingId(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除这条反馈吗？')) return
        setWorkingId(id)
        try {
            await deleteFeedbackFn({ data: { id } })
            refresh()
        } finally {
            setWorkingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="全部反馈"
                description="审核反馈公开状态，并持续跟进处理进度。"
                action={
                    <Link to="/admin/feedbacks/pending">
                        <Button variant="outline"><Icon name="check" /> 待审核</Button>
                    </Link>
                }
            />

            <Card className="grid gap-3 p-4 md:grid-cols-[1fr_12rem]">
                <form onSubmit={handleSearch}>
                    <SearchInput name="search" defaultValue={search} placeholder="搜索反馈标题或内容" />
                </form>
                <select
                    value={status || ''}
                    onChange={(e) => navigate({ to: '/admin/feedbacks', search: { status: e.target.value as FeedbackStatus || undefined, search, page: 1 } })}
                    className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                >
                    <option value="">全部状态</option>
                    <option value="pending">待审核</option>
                    <option value="processing">已公开</option>
                    <option value="resolved">已解决</option>
                    <option value="invalid">已驳回</option>
                </select>
            </Card>

            <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">共 {total} 条</Badge>
                {isLoading ? <Badge>刷新中</Badge> : null}
            </div>

            <Card className="overflow-hidden">
                {feedbacks.length ? (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                            <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.45)] text-left text-xs text-[hsl(var(--muted-foreground))]">
                                <tr>
                                    <th className="px-4 py-3 font-medium">反馈</th>
                                    <th className="px-4 py-3 font-medium">提交人</th>
                                    <th className="px-4 py-3 font-medium">状态</th>
                                    <th className="px-4 py-3 font-medium">时间</th>
                                    <th className="px-4 py-3 text-right font-medium">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[hsl(var(--border))]">
                                {feedbacks.map((feedback) => (
                                    <tr key={feedback.id} className="align-top">
                                        <td className="px-4 py-4">
                                            <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="font-medium hover:text-[hsl(var(--primary))]">
                                                {feedback.title}
                                            </Link>
                                            <p className="mt-1 line-clamp-2 text-[hsl(var(--muted-foreground))]">{feedback.content}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge>{feedbackTargetLabels[feedback.targetType]}</Badge>
                                                {feedback.isAnonymous ? <Badge>匿名</Badge> : null}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">
                                            {feedback.isAnonymous ? '匿名用户' : feedback.author?.name || '未知用户'}
                                        </td>
                                        <td className="px-4 py-4"><FeedbackStatusBadge status={feedback.status} /></td>
                                        <td className="px-4 py-4 text-[hsl(var(--muted-foreground))]">{formatDate(feedback.createdAt)}</td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setReviewingId(feedback.id)}>
                                                    审核
                                                </Button>
                                                <Button size="sm" variant="danger" loading={workingId === feedback.id} onClick={() => handleDelete(feedback.id)}>
                                                    删除
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8">
                        <EmptyState title="没有匹配的反馈" description="调整筛选条件后再试试。" />
                    </div>
                )}
            </Card>

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/admin/feedbacks', search: { status, search, page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/admin/feedbacks', search: { status, search, page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}

            <ReviewModal
                open={!!reviewingId}
                loading={!!reviewingId && workingId === reviewingId}
                onOpenChange={(open) => setReviewingId(open ? reviewingId : null)}
                onSubmit={(status, isPublic, note) => reviewingId ? handleReview(reviewingId, status, isPublic, note) : undefined}
            />
        </div>
    )
}

function ReviewModal({
    open,
    loading,
    onOpenChange,
    onSubmit,
}: {
    open: boolean
    loading: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (status: FeedbackStatus, isPublic: boolean, note?: string) => void
}) {
    return (
        <Modal open={open} title="审核反馈" onOpenChange={onOpenChange}>
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    onSubmit(formData.get('status') as FeedbackStatus, formData.get('isPublic') === 'true', (formData.get('note') as string) || undefined)
                }}
            >
                <label className="block text-sm font-medium">
                    <span>审核状态</span>
                    <select name="status" className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="processing">处理中</option>
                        <option value="resolved">已解决</option>
                        <option value="invalid">无效</option>
                        <option value="pending">退回待审核</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>公开性</span>
                    <select name="isPublic" className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="true">公开</option>
                        <option value="false">不公开</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>审核备注</span>
                    <textarea
                        name="note"
                        rows={4}
                        className="coeer-focus mt-2 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-sm"
                        placeholder="说明处理原因，备注会进入状态记录。"
                    />
                </label>
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button type="submit" loading={loading}>保存</Button>
                </div>
            </form>
        </Modal>
    )
}
