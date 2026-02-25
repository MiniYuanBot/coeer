import { createFileRoute, Link } from '@tanstack/react-router'
import { listPublicGroupsFn } from '~/functions/groups'

export const Route = createFileRoute('/_authed/groups/all')({
    loader: async () => {
        const publicGroups = await listPublicGroupsFn({ data: { page: 1, pageSize: 10 } })
        return { groups: publicGroups?.items ?? [] }
    },
    component: AllGroupsComponent,
})

function AllGroupsComponent() {
    const { groups } = Route.useLoaderData()

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {groups.map((group) => (
                <Link
                    key={group.id}
                    to="/groups/$slug"
                    params={{ slug: group.slug }}
                    className="block border rounded p-4 hover:shadow"
                >
                    <div className="flex justify-between items-start">
                        <h3 className="font-semibold">{group.name}</h3>
                        <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                            {group.category}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {group.description || '暂无描述'}
                    </p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                        <span>创建者: {group.creatorId}</span>
                        <span>•</span>
                        <span>{group.isPublic ? '公开' : '私密'}</span>
                    </div>
                </Link>
            ))}
            
            {groups.length === 0 && (
                <div className="col-span-2 text-center py-12 text-gray-500">
                    暂无公开群组
                </div>
            )}
        </div>
    )
}