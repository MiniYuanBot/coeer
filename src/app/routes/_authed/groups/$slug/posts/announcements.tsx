import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { serial } from 'drizzle-orm/mysql-core'
import z from 'zod'
import { getAnnouncementsFn, getGroupBySlugFn } from '~/functions'

const searchSchema = z.object({
    type: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(10),
})

export const Route = createFileRoute('/_authed/groups/$slug/posts/announcements')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, params, deps: { search } }) => {
        try {
            const group = context.group!

            const result = await getAnnouncementsFn({
                data: {
                    groupId: group.id,
                    pageSize: search.pageSize,
                }
            })
            if (!result) {
                throw redirect({
                    to: '/groups/$slug/posts',
                    params: { slug: params.slug }
                })
            }
            return { group, announcements: result.items || [] }
        } catch (error) {
            throw error
        }
    },
    errorComponent: ({ error }) => {
        throw error
    },
    component: AnnouncementsPage,
})

function AnnouncementsPage() {
    const { group, announcements } = Route.useLoaderData()
    const { slug } = Route.useParams()

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Announcements</h1>
                    <p className="text-gray-600">Official updates from {group.name}</p>
                </div>
                <Link
                    to={`/groups/$slug/posts`}
                    params={{ slug: slug }}
                    className="text-gray-600 hover:text-gray-900 font-medium"
                >
                    ← All Posts
                </Link>
            </div>

            <div className="space-y-4">
                {announcements.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500 text-lg">No announcements yet</p>
                    </div>
                ) : (
                    announcements.map((post) => (
                        <div
                            key={post.id}
                            className="bg-white rounded-xl border border-purple-100 bg-purple-50/30 p-6"
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                                    Announcement
                                </span>
                                {post.isPinned && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                        Pinned
                                    </span>
                                )}
                            </div>

                            <Link to={`/groups/$slug/posts/$postId`} params={{slug: slug, postId: post.id}}>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-blue-600">
                                    {post.title}
                                </h3>
                            </Link>

                            <p className="text-gray-600 line-clamp-2 mb-4">
                                {post.content.replace(/[#*`]/g, '').slice(0, 200)}...
                            </p>

                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-xs">
                                    {(post.author.name || '未知用户').charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-gray-900">{post.author.name}</span>
                                <span>•</span>
                                <time dateTime={post.createdAt.toString()}>
                                    {new Date(post.createdAt).toLocaleDateString()}
                                </time>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}