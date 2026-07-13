import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn } from '~/functions'
import { FeedbackStatus } from '@shared/constants'
import { FeedbackFilterSchema } from '@shared/contracts'
import { Badge, Button, Card, EmptyState, FeedbackCard, Icon, SearchInput, SectionHeader } from '@/components/coeer'

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
    const { status, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const router = useRouter()
    const isLoading = router.state.status === 'pending'
    const totalPages = Math.ceil(total / pageSize)

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const nextSearch = formData.get('search') as string
        navigate({ to: '/feedbacks', search: { status, search: nextSearch || undefined, page: 1 } })
    }

    const handleStatusChange = (newStatus: FeedbackStatus | undefined) => {
        navigate({ to: '/feedbacks', search: { status: newStatus, search, page: 1 } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="反馈"
                description="提交问题、建议与改进线索，推动学院事务闭环。"
                action={<Link to="/feedbacks/create"><Button><Icon name="send" /> 提交反馈</Button></Link>}
            />

            <Card className="grid gap-3 p-4 md:grid-cols-[1fr_12rem]">
                <form onSubmit={handleSearch}>
                    <SearchInput name="search" defaultValue={search} placeholder="搜索反馈标题或内容" />
                </form>
                <select
                    value={status || ''}
                    onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus || undefined)}
                    className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                >
                    <option value="">全部状态</option>
                    <option value="pending">待处理</option>
                    <option value="processing">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="invalid">无效</option>
                </select>
            </Card>

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
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/feedbacks', search: { status, search, page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/feedbacks', search: { status, search, page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
