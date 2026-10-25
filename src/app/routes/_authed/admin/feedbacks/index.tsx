import { UnicodeTextarea } from '@/components/coeer/ui/UnicodeInput'
import { MarkdownSummary } from '@/components/coeer/ui/Markdown'
import { createFileRoute, Link, useHydrated, useRouter, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'
import { deleteFeedbackFn, getFeedbacksFn, updateFeedbackStatusFn } from '~/functions'
import type { FeedbackStatus } from '@shared/constants'
import { FeedbackFilterSchema, type FeedbackWithAuthor } from '@shared/contracts'
import { Badge, Button, DataTable, RowActions, PageLayout, filterGroup, Modal, Pagination, VisibilityBadge, formatDate } from '@/components/coeer'
import { FeedbackStatusBadge, feedbackStatusLabels, feedbackTargetLabels } from '../../feedbacks/-feedback-ui'

const searchSchema = z.object({
    scope: z.enum(['reviewed', 'pending']).optional(),
    status: FeedbackFilterSchema.shape.status,
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
}).transform(value => ({ ...value, scope: value.scope ?? (value.status === 'pending' ? 'pending' : 'reviewed') }))

export const Route = createFileRoute('/_authed/admin/feedbacks/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 10
        const result = await getFeedbacksFn({ data: {
            reviewScope: search.scope,
            status: search.scope === 'pending' ? 'pending' : search.status === 'pending' ? undefined : search.status,
            search: search.search,
            limit: pageSize, offset: (search.page - 1) * pageSize,
        } })
        return { feedbacks: result?.items || [], total: result?.total || 0, pageSize }
    },
    component: AdminFeedbacksPage,
})

function AdminFeedbacksPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const filters = Route.useSearch()
    const { scope, status, search, page } = filters
    const navigate = Route.useNavigate()
    const router = useRouter()
    const hydrated = useHydrated()
    const isPending = useRouterState({ select: state => state.status === 'pending' })
    const [reviewing, setReviewing] = useState<FeedbackWithAuthor | null>(null)
    const [workingId, setWorkingId] = useState<string | null>(null)
    const [error, setError] = useState('')
    const isLoading = hydrated && isPending
    const go = (next: Partial<typeof filters>) => void navigate({ search: { ...filters, page: 1, ...next } })
    const refresh = async (removed = false) => {
        const nextPage = Math.max(1, Math.min(page, Math.ceil((total - (removed ? 1 : 0)) / pageSize)))
        if (nextPage !== page) await navigate({ search: { ...filters, page: nextPage } })
        await router.invalidate()
    }
    const handleReview = async (nextStatus: FeedbackStatus, isPublic: boolean, note?: string) => {
        if (!reviewing || workingId) return
        setWorkingId(reviewing.id)
        setError('')
        try {
            await updateFeedbackStatusFn({ data: { id: reviewing.id, status: nextStatus, isPublic, note } })
            const leavesScope = scope === 'pending' ? nextStatus !== 'pending' : nextStatus === 'pending' || (!!status && status !== nextStatus)
            await refresh(leavesScope)
            setReviewing(null)
        } catch (error) { setError(error instanceof Error ? error.message : '保存失败，请重试') }
        finally { setWorkingId(null) }
    }
    const handleDelete = async (id: string) => {
        if (workingId || !confirm('确定删除这条反馈吗？')) return
        setWorkingId(id)
        setError('')
        try { await deleteFeedbackFn({ data: { id } }); await refresh(true) }
        catch (error) { setError(error instanceof Error ? error.message : '删除失败，请重试') }
        finally { setWorkingId(null) }
    }
    return <PageLayout title="反馈管理"
            description="审核反馈公开状态，并持续跟进处理进度。"
            busy={isLoading}
            scope={{ title: '反馈管理范围', items: [
                { key: 'reviewed', label: '已审核反馈', active: scope === 'reviewed', onClick: () => go({ scope: 'reviewed', status: undefined }) },
                { key: 'pending', label: '审核队列', active: scope === 'pending', onClick: () => go({ scope: 'pending', status: undefined }) },
            ] }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索反馈标题或内容",
                onSearch: search => go({ search: search || undefined }),
                onClear: () => go({ search: undefined, status: undefined }),
                groups: scope === 'pending' ? [] : [filterGroup('状态', ['processing', 'resolved', 'invalid'] as const, feedbackStatusLabels, status === 'pending' ? undefined : status, status => go({ status }), '全部状态')]
            }}>

        <span className="sr-only" role="status">{isLoading ? '刷新中' : ''}</span>
        {error && !reviewing && <p role="alert" className="text-sm text-danger">{error}</p>}
        <DataTable label="反馈管理表" rows={feedbacks} rowKey={feedback => feedback.id} emptyTitle="没有匹配的反馈" emptyDescription="调整筛选条件后再试试。" columns={[
            { key: 'feedback', header: '反馈', render: feedback => <>
                <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} title={feedback.title} className="coeer-focus line-clamp-2 break-words rounded font-medium hover:text-primary">{feedback.title}</Link>
                <MarkdownSummary content={feedback.content} className="mt-1 text-muted-foreground" />
                <div className="mt-2 flex flex-wrap gap-2"><Badge>{feedbackTargetLabels[feedback.targetType]}</Badge><VisibilityBadge visible={feedback.isPublic} hiddenLabel="非公开" />{feedback.isAnonymous && <Badge>匿名</Badge>}</div>
            </> },
            { key: 'author', header: '提交人', width: '7rem', render: feedback => feedback.isAnonymous ? '匿名用户' : feedback.author?.name || '未知用户' },
            { key: 'status', header: '状态', width: '6rem', render: feedback => <FeedbackStatusBadge status={feedback.status} /> },
            { key: 'time', header: '时间', width: '6rem', render: feedback => formatDate(feedback.createdAt) },
            { key: 'actions', header: '操作', width: '10rem', align: 'right', render: feedback => <RowActions>
                <Button size="sm" variant="outline" disabled={!!workingId} onClick={() => { setError(''); setReviewing(feedback) }}>{scope === 'pending' ? '审核' : '编辑'}</Button>
                <Button size="sm" variant="danger" loading={workingId === feedback.id} disabled={!!workingId} onClick={() => void handleDelete(feedback.id)}>删除</Button>
            </RowActions> },
        ]} />
        <Pagination total={total} page={page} size={pageSize} onChange={page => go({ page })} />
        <ReviewModal feedback={reviewing ?? undefined} open={!!reviewing} loading={!!workingId} error={error}
            onOpenChange={open => { if (!open && !workingId) setReviewing(null) }} onSubmit={handleReview} />
    </PageLayout>
}

function ReviewModal({
    feedback,
    open,
    loading,
    error,
    onOpenChange,
    onSubmit,
}: {
    feedback?: Pick<FeedbackWithAuthor, 'id' | 'status' | 'isPublic'>
    open: boolean
    error: string
    loading: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (status: FeedbackStatus, isPublic: boolean, note?: string) => void
}) {
    return (
        <Modal open={open} title={feedback?.status === 'pending' ? '审核反馈' : '编辑反馈'} onOpenChange={onOpenChange}>
            <form key={feedback?.id}
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault()
                    const formData = new FormData(e.currentTarget)
                    onSubmit(formData.get('status') as FeedbackStatus, formData.get('isPublic') === 'true', (formData.get('note') as string) || undefined)
                }}
            >
                <label className="block text-sm font-medium">
                    <span>审核状态</span>
                    <select name="status" defaultValue={feedback?.status ?? 'pending'} className="coeer-field coeer-focus mt-2 h-10 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="processing">处理中</option>
                        <option value="resolved">已解决</option>
                        <option value="invalid">无效</option>
                        <option value="pending">退回待审核</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>公开性</span>
                    <select name="isPublic" defaultValue={String(feedback?.isPublic ?? false)} className="coeer-field coeer-focus mt-2 h-10 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 text-sm">
                        <option value="true">公开</option>
                        <option value="false">非公开</option>
                    </select>
                </label>
                <label className="block text-sm font-medium">
                    <span>审核备注</span>
                    <UnicodeTextarea
                        name="note"
                        maxLength={1000}
                        rows={4}
                        className="coeer-field coeer-focus mt-2 w-full rounded-lg border border-control-border bg-[hsl(var(--card))] px-3 py-2 text-sm"
                        placeholder="说明处理原因，备注会进入状态记录。"
                    />
                </label>
                {error && <p role="alert" className="text-sm text-danger">{error}</p>}
                <div className="coeer-form-actions">
                    <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>取消</Button>
                    <Button type="submit" loading={loading}>保存</Button>
                </div>
            </form>
        </Modal>
    )
}
