import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { listAllGroupsFn } from '~/functions'
import { ButtonLink, Button } from '@/components/ui/Button'
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
        const pageSize = 5

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
            pageSize
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
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">发现群组</h1>
                <ButtonLink to="/groups/create">创建群组</ButtonLink>
            </div>

            <div className="flex gap-4 bg-white p-4 rounded-lg shadow-sm">
                <input
                    type="text"
                    placeholder="搜索群组..."
                    defaultValue={search}
                    onChange={(e) => {
                        const value = e.target.value
                        navigate({
                            search: (prev) => ({ ...prev, search: value || undefined, page: 1 }),
                        })
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                    value={category || ''}
                    onChange={(e) => {
                        const value = e.target.value as GroupCategory
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                category: value || undefined,
                                page: 1,
                            }),
                        })
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">全部分类</option>
                    <option value="TECH">技术</option>
                    <option value="LIFE">生活</option>
                    <option value="GAME">游戏</option>
                    <option value="STUDY">学习</option>
                    <option value="OTHER">其他</option>
                </select>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                    <p className="text-gray-500">暂无符合条件的群组</p>
                    <Link
                        to="/groups/create"
                        className="mt-4 inline-block text-blue-600 hover:text-blue-800"
                    >
                        创建一个群组
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                        <Link
                            key={group.id}
                            to="/groups/$slug"
                            params={{ slug: group.slug }}
                            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {group.name}
                                    </h3>
                                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                                        {group.description || '暂无描述'}
                                    </p>
                                </div>
                                {/* {group.avatarUrl ? (
                                    <img
                                        src={group.avatarUrl}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-lg font-bold">
                                        {group.name[0]}
                                    </div>
                                )} */}
                            </div>
                            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                                <span>{group.category}</span>
                                <span>{group.isPublic ? '公开' : '私密'}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                        disabled={page <= 1}
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, page: prev.page - 1 }),
                            })
                        }
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        上一页
                    </button>
                    <span className="text-sm text-gray-600">
                        {page} / {totalPages}
                    </span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() =>
                            navigate({
                                search: (prev) => ({ ...prev, page: prev.page + 1 }),
                            })
                        }
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-gray-100"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    )
}