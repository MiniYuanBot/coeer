import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Badge, Button, Card, EmptyState, GroupCard, Icon, SearchInput, SectionHeader } from '@/components/coeer'
import { listAllGroupsFn } from '~/functions'
import { GroupFilterSchema } from '@shared/contracts'
import { GroupCategory } from '@shared/constants'

const searchSchema = z.object({
    ...GroupFilterSchema.shape,
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/groups/all')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search } }) => {
        const pageSize = 9
        const result = await listAllGroupsFn({
            data: {
                category: search.category,
                search: search.search,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            groups: result?.items ?? [],
            total: result?.total ?? 0,
            pageSize,
        }
    },
    component: GroupsAllPage,
})

function GroupsAllPage() {
    const { groups, total, pageSize } = Route.useLoaderData()
    const { category, search, page } = Route.useSearch()
    const navigate = Route.useNavigate()
    const totalPages = Math.ceil(total / pageSize)

    return (
        <div className="space-y-6">
            <SectionHeader
                title="群组"
                description="发现组织、兴趣、项目和学习小组。"
                action={<Link to="/groups/create"><Button><Icon name="group" /> 创建群组</Button></Link>}
            />

            <Card className="grid gap-3 p-4 md:grid-cols-[1fr_14rem]">
                <SearchInput
                    placeholder="搜索群组"
                    defaultValue={search}
                    onChange={(e) => {
                        const value = e.target.value
                        navigate({ search: (prev) => ({ ...prev, search: value || undefined, page: 1 }) })
                    }}
                />
                <select
                    value={category || ''}
                    onChange={(e) => {
                        const value = e.target.value as GroupCategory
                        navigate({ search: (prev) => ({ ...prev, category: value || undefined, page: 1 }) })
                    }}
                    className="coeer-focus h-10 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                >
                    <option value="">全部分类</option>
                    <option value="organization">组织</option>
                    <option value="interest">兴趣</option>
                    <option value="project">项目</option>
                    <option value="course">课程</option>
                    <option value="other">其他</option>
                </select>
            </Card>

            <div className="flex flex-wrap gap-2">
                <Badge tone="primary">全部 {total}</Badge>
                <Badge>公开群组</Badge>
                <Badge>申请中</Badge>
            </div>

            {groups.length ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) => <GroupCard key={group.id} group={group} />)}
                </div>
            ) : (
                <EmptyState title="没有找到群组" description="换个关键词试试，或者创建一个新的群组。" action={<Link to="/groups/create"><Button>创建群组</Button></Link>} />
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
