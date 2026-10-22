import { createFileRoute, Link, useHydrated, useNavigate, useRouterState } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn } from '~/functions'
import { FEEDBACK_TARGET_TYPE_ARRAY, FeedbackTargetType } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Button, EmptyState, FeedbackCard, FilterPanel, Icon, PageLayout, SectionHeader, feedbackTargetLabels } from '@/components/coeer'

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
            data: { ...search, limit: pageSize, offset: (search.page - 1) * pageSize },
        })
        return { feedbacks: result?.items || [], total: result?.total || 0, pageSize }
    },
    component: FeedbacksListPage,
})

function FeedbacksListPage() {
    const { feedbacks, total, pageSize } = Route.useLoaderData()
    const { view, targetType, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const hydrated = useHydrated()
    const isPending = useRouterState({ select: (state) => state.status === 'pending' })
    const isLoading = hydrated && isPending
    const totalPages = Math.ceil(total / pageSize)
    const go = (next: { view?: 'mine' | 'public'; targetType?: FeedbackTargetType; search?: string; page?: number }) => {
        void navigate({ to: '/feedbacks', search: { view, targetType, search, page: 1, ...next } })
    }
    return (
        <PageLayout>
            <SectionHeader title="反馈" description="每一个建议，都是让学院变得更好的开始。查看问题进展，参与社区改进。"
                action={<Button asChild><Link to="/feedbacks/create"><Icon name="plus" />提交反馈</Link></Button>} />
            <div>
                <div role="group" aria-label="反馈范围" className="flex gap-6 border-b border-border">
                    {[{ key: 'public', label: '公开反馈' }, { key: 'mine', label: '我提交的' }].map((item) => {
                        const active = item.key === (view || 'public')
                        return (
                            <button key={item.key} type="button" aria-pressed={active} onClick={() => go({ view: item.key as 'mine' | 'public' })}
                                className={'coeer-focus -mb-px flex items-center gap-2 border-b-2 px-0.5 pb-3 text-[13px] ' + (active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
                                {item.label}{active ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{total}</span> : null}
                            </button>
                        )
                    })}
                </div>
                <FilterPanel className="border-t-0" searchValue={search} searchPlaceholder="搜索反馈标题或内容"
                    onSearch={(value) => go({ search: value || undefined })}
                    groups={[{
                        title: '类型',
                        items: [
                            { key: 'all-targets', label: '全部类型', active: !targetType, onClick: () => go({ targetType: undefined }) },
                            ...FEEDBACK_TARGET_TYPE_ARRAY.map((item) => ({ key: item, label: feedbackTargetLabels[item], active: targetType === item, onClick: () => go({ targetType: item as FeedbackTargetType }) })),
                        ],
                    }]} />
                <section aria-label="反馈列表" aria-busy={isLoading}>
                    <div className="flex items-center gap-2 bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground sm:grid sm:grid-cols-[20px_minmax(0,1fr)_84px_64px] sm:gap-3">
                        <Icon name="list" className="h-3.5 w-3.5" />
                        <span>{isLoading ? '正在更新…' : '反馈内容'}</span>
                        <span className="hidden sm:block">状态</span>
                        <span className="hidden text-right sm:block">提交时间</span>
                    </div>
                    {feedbacks.length ? (
                        <div className="divide-y divide-border border-b border-border">
                            {feedbacks.map((feedback) => <FeedbackCard key={feedback.id} feedback={feedback} variant="row" />)}
                        </div>
                    ) : (
                        <EmptyState title={search || targetType ? '没有匹配的反馈' : '暂无反馈'}
                            description={search || targetType ? '试试其他关键词，或清除筛选查看全部反馈。' : '提交你遇到的问题或建议，在这里跟进处理进展。'}
                            action={search || targetType ? <Button variant="secondary" onClick={() => go({ search: undefined, targetType: undefined })}>清除筛选</Button> : <Button asChild><Link to="/feedbacks/create">提交反馈</Link></Button>} />
                    )}
                </section>
                <footer className="flex flex-wrap items-center justify-between gap-3 pt-4">
                    <p aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{total ? '共 ' + total + ' 条反馈，显示 ' + ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, total) + ' 条' : '共 0 条反馈'}</p>
                    {totalPages > 1 ? <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" disabled={page <= 1 || isLoading} onClick={() => go({ page: page - 1 })}>上一页</Button>
                        <span className="px-1 text-xs tabular-nums text-muted-foreground">{page} / {totalPages}</span>
                        <Button size="sm" variant="outline" disabled={page >= totalPages || isLoading} onClick={() => go({ page: page + 1 })}>下一页</Button>
                    </div> : null}
                </footer>
            </div>
        </PageLayout>
    )
}
