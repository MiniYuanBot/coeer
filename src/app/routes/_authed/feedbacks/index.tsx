import { createFileRoute, Link, useHydrated, useRouterState } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn } from '~/functions'
import { FEEDBACK_TARGET_TYPE_ARRAY, FeedbackTargetType } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Button, EmptyState, FeedbackCard, FilterPanel, Icon, PageLayout, Pagination, SectionHeader, feedbackTargetLabels } from '@/components/coeer'

const searchSchema = z.object({
    ...FeedbackFilterSchema.shape,
    page: z.number().int().min(1).default(1),
})

export const Route = createFileRoute('/_authed/feedbacks/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 8
        const result = await getFeedbacksFn({
            data: { ...search, view: search.view ?? 'public', limit: pageSize, offset: (search.page - 1) * pageSize },
        })
        return { feedbacks: result?.items || [], total: result?.total || 0, pageSize }
    },
    component: FeedbacksListPage,
})

function FeedbacksListPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const { view, targetType, search, page } = Route.useSearch()
    const navigate = Route.useNavigate()
    const hydrated = useHydrated()
    const isPending = useRouterState({ select: (state) => state.status === 'pending' })
    const isLoading = hydrated && isPending
    const go = (next: { view?: 'mine' | 'public'; targetType?: FeedbackTargetType; search?: string; page?: number }) => {
        void navigate({ to: '/feedbacks', search: previous => ({ ...previous, page: 1, ...next }) })
    }
    return (
        <PageLayout>
            <SectionHeader title="反馈" description="每一个建议，都是让学院变得更好的开始。查看问题进展，参与社区改进。"
                action={<Button asChild><Link to="/feedbacks/create"><Icon name="plus" />提交反馈</Link></Button>} />
                <FilterPanel searchValue={search} searchPlaceholder="搜索反馈标题或内容"
                    scope={{ title: '反馈范围', items: [
                        { key: 'public', label: '公开反馈', active: (view || 'public') === 'public', onClick: () => go({ view: 'public' }) },
                        { key: 'mine', label: '我提交的', active: view === 'mine', onClick: () => go({ view: 'mine' }) },
                    ] }}
                    onSearch={(value) => go({ search: value || undefined })}
                    onClear={() => go({ search: undefined, targetType: undefined })}
                    groups={[{
                        title: '类型',
                        items: [
                            { key: 'all-targets', label: '全部类型', active: !targetType, onClick: () => go({ targetType: undefined }) },
                            ...FEEDBACK_TARGET_TYPE_ARRAY.map((item) => ({ key: item, label: feedbackTargetLabels[item], active: targetType === item, onClick: () => go({ targetType: item as FeedbackTargetType }) })),
                        ],
                    }]} />
                <section aria-label="反馈列表" aria-busy={isLoading}>
                    {isLoading ? <p role="status" className="mb-3 text-xs text-muted-foreground">正在更新反馈…</p> : null}
                    {feedbacks.length ? (
                        <div className="coeer-grid">
                            {feedbacks.map((feedback) => <FeedbackCard key={feedback.id} feedback={feedback} />)}
                        </div>
                    ) : (
                        <EmptyState title={search || targetType ? '没有匹配的反馈' : '暂无反馈'}
                            description={search || targetType ? '试试其他关键词，或清除筛选查看全部反馈。' : '提交你遇到的问题或建议，在这里跟进处理进展。'}
                            action={search || targetType ? <Button variant="secondary" onClick={() => go({ search: undefined, targetType: undefined })}>清除筛选</Button> : <Button asChild><Link to="/feedbacks/create">提交反馈</Link></Button>} />
                    )}
                </section>
                <Pagination total={total} page={page} size={pageSize} disabled={isLoading} onChange={(page) => go({ page })} />
        </PageLayout>
    )
}
