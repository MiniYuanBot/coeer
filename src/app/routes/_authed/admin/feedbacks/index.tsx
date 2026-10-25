import { TableScroll } from '@/components/coeer/ui/TableScroll'
import { ViewTabs } from '@/components/coeer/ui/NavTabs'
import { MarkdownSummary } from '@/components/coeer/ui/Markdown'
import { createFileRoute, Link, useHydrated, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { deleteFeedbackFn, getFeedbacksFn, updateFeedbackStatusFn } from '~/functions'
import { FeedbackStatus } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, FilterPanel, Icon, Modal, Pagination, SectionHeader, formatDate } from '@/components/coeer'
import { FeedbackStatusBadge, feedbackTargetLabels } from '../../feedbacks/-feedback-ui'

const searchSchema = z.object({
    ...FeedbackFilterSchema.shape,
    page: z.number().int().min(1).default(1),
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
    const navigate = Route.useNavigate()
    const hydrated = useHydrated()
    const isPending = useRouterState({ select: state => state.status === 'pending' })
    const [reviewingId, setReviewingId] = useState<string | null>(null)
    const [workingId, setWorkingId] = useState<string | null>(null)
    const isLoading = hydrated && isPending

    const refresh = () => navigate({ to: '/admin/feedbacks', search: { status, search, page } })

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
        <div className="space-y-6" aria-busy={isLoading}>
            <SectionHeader
                title="反馈管理"
                description="审核反馈公开状态，并持续跟进处理进度。"
            />

            <ViewTabs label="反馈管理范围" items={[
                { key: 'all', label: '全部反馈', active: status !== 'pending', onClick: () => void navigate({ to: '/admin/feedbacks', search: previous => ({ ...previous, status: undefined, page: 1 }) }) },
                { key: 'pending', label: '审核队列', active: status === 'pending', onClick: () => void navigate({ to: '/admin/feedbacks', search: previous => ({ ...previous, status: 'pending', page: 1 }) }) },
            ]} />

            <FilterPanel searchValue={search} searchPlaceholder="搜索反馈标题或内容"
                onSearch={value => void navigate({ to: '/admin/feedbacks', search: previous => ({ ...previous, search: value || undefined, page: 1 }) })}
                groups={[{ title: '状态', items: [
                    { key: '', label: '全部状态' }, { key: 'pending', label: '待审核' },
                    { key: 'processing', label: '处理中' }, { key: 'resolved', label: '已解决' }, { key: 'invalid', label: '已驳回' },
                ].map(item => ({ ...item, active: (status || '') === item.key,
                    onClick: () => void navigate({ to: '/admin/feedbacks', search: previous => ({ ...previous, status: item.key as FeedbackStatus || undefined, page: 1 }) }),
                })) }]} />

            <span className="sr-only" role="status">{isLoading ? '刷新中' : ''}</span>
            <Card className="overflow-hidden">
                {feedbacks.length ? (
                    <TableScroll label="反馈管理表">
                        <table className="w-full min-w-[760px] table-fixed text-sm">
                            <colgroup><col /><col className="w-28" /><col className="w-24" /><col className="w-24" /><col className="w-40" /></colgroup>
                            <thead className="border-b border-[hsl(var(--border))] bg-muted text-left text-xs text-[hsl(var(--muted-foreground))]">
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
                                    <tr key={feedback.id} className="align-middle">
                                        <td className="px-4 py-4">
                                            <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} title={feedback.title} className="coeer-focus line-clamp-2 break-words rounded font-medium hover:text-[hsl(var(--primary))]">
                                                {feedback.title}
                                            </Link>
                                            <MarkdownSummary content={feedback.content} className="mt-1 text-muted-foreground" />
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge>{feedbackTargetLabels[feedback.targetType]}</Badge>
                                                {feedback.isAnonymous ? <Badge>匿名</Badge> : null}
                                            </div>
                                        </td>
                                        <td className="break-words px-4 py-4 text-[hsl(var(--muted-foreground))]">
                                            {feedback.isAnonymous ? '匿名用户' : feedback.author?.name || '未知用户'}
                                        </td>
                                        <td className="px-4 py-4"><FeedbackStatusBadge status={feedback.status} /></td>
                                        <td className="whitespace-nowrap px-4 py-4 text-[hsl(var(--muted-foreground))]">{formatDate(feedback.createdAt)}</td>
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
                    </TableScroll>
                ) : (
                    <div className="p-8">
                        <EmptyState title="没有匹配的反馈" description="调整筛选条件后再试试。" />
                    </div>
                )}
            </Card>

            <Pagination total={total} page={page} size={pageSize} onChange={(page) => void navigate({ to: '/admin/feedbacks', search: { status, search, page } })} />

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
                    <select name="status" className="coeer-field coeer-focus mt-2 h-10 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="processing">处理中</option>
                        <option value="resolved">已解决</option>
                        <option value="invalid">无效</option>
                        <option value="pending">退回待审核</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>公开性</span>
                    <select name="isPublic" className="coeer-field coeer-focus mt-2 h-10 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="true">公开</option>
                        <option value="false">不公开</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>审核备注</span>
                    <textarea
                        name="note"
                        rows={4}
                        className="coeer-field coeer-focus mt-2 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 py-2 text-sm"
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
