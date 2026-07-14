import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn } from '~/functions'
import { FEEDBACK_TARGET_TYPE_ARRAY, FeedbackTargetType } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Badge, Button, EmptyState, FeedbackCard, FilterPanel, Icon, SectionHeader, feedbackTargetLabels } from '@/components/coeer'

const searchSchema = z.object({
    ...FeedbackFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/feedbacks/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 8
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
    component: FeedbacksListPage,
})

function FeedbacksListPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const { view, targetType, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const router = useRouter()
    const isLoading = router.state.status === 'pending'
    const totalPages = Math.ceil(total / pageSize)

    const go = (next: { view?: 'mine' | 'public'; targetType?: FeedbackTargetType; search?: string; page?: number }) => {
        navigate({ to: '/feedbacks', search: { view, targetType, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="反馈"
                description="提交问题、建议与改进线索，推动学院事务闭环。"
                action={<Link to="/feedbacks/create"><Button><Icon name="send" /> 提交反馈</Button></Link>}
            />

            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索反馈标题或内容"
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '查看',
                        items: [
                            { key: 'mine', label: '我提交的', active: view === 'mine', onClick: () => go({ view: 'mine' }) },
                            { key: 'public', label: '所有公开的', active: view === 'public' || !view, onClick: () => go({ view: 'public' }) },
                        ],
                    },
                    {
                        title: '类型',
                        items: [
                            { key: 'all-targets', label: '全部类型', active: !targetType, onClick: () => go({ targetType: undefined }) },
                            ...FEEDBACK_TARGET_TYPE_ARRAY.map((item) => ({
                                key: item,
                                label: feedbackTargetLabels[item],
                                active: targetType === item,
                                onClick: () => go({ targetType: item as FeedbackTargetType }),
                            })),
                        ],
                    },
                ]}
            />

            <div className="flex flex-wrap items-center gap-2">
                <Badge tone="primary">全部 {total}</Badge>
                {isLoading ? <Badge>刷新中</Badge> : null}
            </div>

            {feedbacks.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {feedbacks.map((feedback) => <FeedbackCard key={feedback.id} feedback={feedback} />)}
                </div>
            ) : (
                <EmptyState title="暂无反馈" description="成为第一个提交反馈的人。" action={<Link to="/feedbacks/create"><Button>提交反馈</Button></Link>} />
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/feedbacks', search: { view, targetType, search, page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/feedbacks', search: { view, targetType, search, page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
