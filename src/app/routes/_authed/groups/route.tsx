import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { z } from 'zod'
import { listAllGroupsFn, listMyGroupsFn } from '~/functions'
import { GroupFilterSchema } from '@shared/contracts'
import { GROUP_CATEGORY_ARRAY, GROUP_MEMBER_ROLE, GROUP_MEMBER_STATUS, GroupCategory } from '@shared/constants'
import { Button, EmptyState, FilterPanel, GroupCard, Icon, SectionHeader, groupCategoryLabels } from '@/components/coeer'

const groupViewSchema = z.enum(['joined', 'managed', 'public', 'pending']).default('joined')

const searchSchema = z.object({
    ...GroupFilterSchema.shape,
    view: groupViewSchema,
    page: z.number().default(1),
})

type GroupsSearch = z.infer<typeof searchSchema>

export const Route = createFileRoute('/_authed/groups')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ deps: { search }, location }) => {
        if (location.pathname !== '/groups') return null

        const pageSize = 9
        if (search.view === 'public') {
            const result = await listAllGroupsFn({
                data: {
                    status: 'approved',
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
        }

        const result = await listMyGroupsFn({
            data: {
                status: search.view === 'pending' ? GROUP_MEMBER_STATUS.PENDING : GROUP_MEMBER_STATUS.APPROVED,
                role: search.view === 'managed' ? GROUP_MEMBER_ROLE.ADMIN : undefined,
                limit: 100,
                offset: 0,
            },
        })
        const keyword = search.search?.trim().toLowerCase()
        const groups = (result?.items ?? [])
            .map((member) => member.group)
            .filter((group) => !search.category || group.category === search.category)
            .filter((group) => {
                if (!keyword) return true
                return group.name.toLowerCase().includes(keyword) ||
                    group.slug.toLowerCase().includes(keyword) ||
                    group.description?.toLowerCase().includes(keyword)
            })
        const offset = (search.page - 1) * pageSize

        return {
            groups: groups.slice(offset, offset + pageSize),
            total: groups.length,
            pageSize,
        }
    },
    component: GroupsRouteComponent,
})

function GroupsRouteComponent() {
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    if (pathname !== '/groups') return <Outlet />

    return <GroupsHomePage />
}

function GroupsHomePage() {
    const data = Route.useLoaderData()
    const { view, category, search, page } = Route.useSearch()
    const navigate = useNavigate()
    const groups = data?.groups ?? []
    const total = data?.total ?? 0
    const pageSize = data?.pageSize ?? 9
    const totalPages = Math.ceil(total / pageSize)

    const go = (next: Partial<GroupsSearch>) => {
        navigate({ to: '/groups', search: { view, category, search, page: 1, ...next } })
    }

    return (
        <div className="space-y-6">
            <SectionHeader
                title="群组"
                description="发现组织、兴趣、项目和课程群组，也可以快速查看自己的群组申请。"
                action={<Link to="/groups/create"><Button><Icon name="group" /> 创建群组</Button></Link>}
            />

            <FilterPanel
                searchValue={search}
                searchPlaceholder="搜索群组名称、slug 或描述"
                onSearch={(value) => go({ search: value || undefined })}
                groups={[
                    {
                        title: '查看',
                        items: [
                            { key: 'joined', label: '我加入的', active: view === 'joined', onClick: () => go({ view: 'joined' }) },
                            { key: 'managed', label: '我管理的', active: view === 'managed', onClick: () => go({ view: 'managed' }) },
                            { key: 'public', label: '公开的', active: view === 'public', onClick: () => go({ view: 'public' }) },
                            { key: 'pending', label: '申请中', active: view === 'pending', onClick: () => go({ view: 'pending' }) },
                        ],
                    },
                    {
                        title: '类型',
                        items: [
                            { key: 'all', label: '全部类型', active: !category, onClick: () => go({ category: undefined }) },
                            ...GROUP_CATEGORY_ARRAY.map((item) => ({
                                key: item,
                                label: groupCategoryLabels[item],
                                active: category === item,
                                onClick: () => go({ category: item as GroupCategory }),
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
                <EmptyState title="没有找到群组" description="换个关键词或分类试试。" action={<Link to="/groups/create"><Button>创建群组</Button></Link>} />
            )}

            {totalPages > 1 ? (
                <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" disabled={page <= 1} onClick={() => navigate({ to: '/groups', search: { view, category, search, page: page - 1 } })}>上一页</Button>
                    <span className="text-sm text-[hsl(var(--muted-foreground))]">{page} / {totalPages}</span>
                    <Button variant="outline" disabled={page >= totalPages} onClick={() => navigate({ to: '/groups', search: { view, category, search, page: page + 1 } })}>下一页</Button>
                </div>
            ) : null}
        </div>
    )
}
