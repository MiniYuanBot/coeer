import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { Button, EmptyState, FilterPanel, GroupCard, Icon, SectionHeader, groupCategoryLabels } from '@/components/coeer'
import { listAllGroupsFn } from '~/functions'
import { GroupFilterSchema } from '@shared/contracts'
import { GROUP_CATEGORY_ARRAY, GroupCategory } from '@shared/constants'

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

            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索群组名称、slug 或描述"
                onSearch={(value) => navigate({ search: (prev) => ({ ...prev, search: value || undefined, page: 1 }) })}
                groups={[
                    {
                        items: [
                            { key: 'all', label: `全部 ${total}`, active: !category, onClick: () => navigate({ search: (prev) => ({ ...prev, category: undefined, page: 1 }) }) },
                            ...GROUP_CATEGORY_ARRAY.map((item) => ({
                                key: item,
                                label: groupCategoryLabels[item],
                                active: category === item,
                                onClick: () => navigate({ search: (prev) => ({ ...prev, category: item as GroupCategory, page: 1 }) }),
                            })),
                        ],
                    },
                ]}
            />

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
