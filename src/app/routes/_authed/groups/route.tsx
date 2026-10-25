import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router'
import { z } from 'zod'
import { listAllGroupsFn, listMyGroupsFn } from '~/functions'
import { GroupFilterSchema } from '@shared/contracts'
import { GROUP_CATEGORY_ARRAY, GROUP_MEMBER_ROLE, GROUP_MEMBER_STATUS, GroupCategory } from '@shared/constants'
import { Button, EmptyState, GroupCard, Icon, Pagination, groupCategoryLabels } from '@/components/coeer'

const groupViewSchema = z.enum(['joined', 'managed', 'public', 'pending']).default('joined')

const searchSchema = z.object({
    ...GroupFilterSchema.shape,
    view: groupViewSchema,
    page: z.number().int().min(1).default(1),
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
                category: search.category,
                search: search.search,
                limit: pageSize,
                offset: (search.page - 1) * pageSize,
            },
        })
        return {
            groups: (result?.items ?? []).map((member) => member.group),
            total: result?.total ?? 0,
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
    const navigate = Route.useNavigate()
    const groups = data?.groups ?? []
    const total = data?.total ?? 0
    const pageSize = data?.pageSize ?? 9

    const go = (next: Partial<GroupsSearch>) => {
        navigate({ to: '/groups', search: previous => ({ ...previous, page: 1, ...next }) })
    }

    return (
        <PageLayout title="群组"
            description="发现组织、兴趣、项目和课程群组，也可以快速查看自己的群组申请。"
            action={<Button asChild><Link to="/groups/create"><Icon name="group" /> 创建群组</Link></Button>}
            scope={{
                        title: '群组范围',
                        items: [
                            { key: 'joined', label: '我加入的', active: view === 'joined', onClick: () => go({ view: 'joined' }) },
                            { key: 'managed', label: '我管理的', active: view === 'managed', onClick: () => go({ view: 'managed' }) },
                            { key: 'public', label: '公开的', active: view === 'public', onClick: () => go({ view: 'public' }) },
                            { key: 'pending', label: '申请中', active: view === 'pending', onClick: () => go({ view: 'pending' }) },
                        ],
                    }}
            filters={{
                searchValue: search,
                searchPlaceholder: "搜索群组名称、介绍或完整 slug",
                onSearch: (value) => go({ search: value || undefined }),
                onClear: () => go({ search: undefined, category: undefined }),
                groups: [
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
                ]
            }}>

            {groups.length ? (
                <div className="coeer-grid">
                    {groups.map((group) => <GroupCard key={group.id} group={group} />)}
                </div>
            ) : (
                <EmptyState title="没有找到群组" description="换个关键词或分类试试。" action={<Link to="/groups/create"><Button>创建群组</Button></Link>} />
            )}

            <Pagination total={total} page={page} size={pageSize} onChange={(page) => go({ page })} />
        </PageLayout>
    )
}
