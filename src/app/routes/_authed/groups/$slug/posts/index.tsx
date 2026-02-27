import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { listGroupPostsFn, deleteGroupPostFn, togglePinPostFn, getGroupBySlugFn } from '~/functions'
import type { GroupPostWithAuthor } from '@shared/contracts'
import { GroupPostType } from '@shared/constants'

const searchSchema = z.object({
    type: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(20),
})

export const Route = createFileRoute('/_authed/groups/$slug/posts/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => ({ search }),
    loader: async ({ context, params, deps: { search } }) => {
        const group = context.group!

        const posts = await listGroupPostsFn({
            data: {
                groupId: group.id,
                type: search.type as GroupPostType | undefined,
                page: search.page,
                pageSize: search.pageSize,
            }
        })

        return {
            posts: posts?.items || [],
            total: posts?.total || 0,
            page: search.page,
            pageSize: search.pageSize,
            type: search.type as GroupPostType | undefined,
        }
    },
    component: PostsListPage,
})

function PostsListPage() {
    const { posts, total, page, pageSize, type } = Route.useLoaderData()
    const navigate = useNavigate()
    const { slug } = Route.useParams()

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [deletingPost, setDeletingPost] = useState<GroupPostWithAuthor | null>(null)
    const [isAdmin, setIsAdmin] = useState(false) // Should come from auth context

    const totalPages = Math.ceil(total / pageSize)

    const handleDelete = async (postId: string) => {
        await deleteGroupPostFn({ data: { id: postId } })
        setShowDeleteConfirm(false)
        setDeletingPost(null)
        navigate({
            to: `/groups/${slug}/posts`,
            search: { type, page, pageSize }
        })
    }

    const handleTogglePin = async (postId: string, isPinned: boolean) => {
        await togglePinPostFn({ data: { id: postId, isPinned } })
        navigate({
            to: `/groups/${slug}/posts`,
            search: { type, page, pageSize }
        })
    }

    const handleFilterChange = (newType: GroupPostType | undefined) => {
        navigate({
            to: `/groups/${slug}/posts`,
            search: {
                type: newType,
                page: 1,
                pageSize: pageSize
            }
        })
    }

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Posts</h1>
                    <p className="text-gray-600">Share discussions and announcements with the group</p>
                </div>
                <Link
                    to={`/groups/$slug/posts/create`}
                    params={{ slug: slug }}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    New Post
                </Link>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => handleFilterChange(undefined)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!type
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                >
                    All
                </button>
                <button
                    onClick={() => handleFilterChange('discussion')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'discussion'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                >
                    Discussions
                </button>
                <button
                    onClick={() => handleFilterChange('announcement')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${type === 'announcement'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                >
                    Announcements
                </button>
            </div>

            {/* Posts List */}
            <div className="space-y-4">
                {posts.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
                        <p className="text-gray-500 text-lg mb-4">No posts yet</p>
                        <Link
                            to={`/groups/$slug/posts/create`}
                            params={{ slug: slug }}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Create the first post →
                        </Link>
                    </div>
                ) : (
                    posts.map((post) => (
                        <div
                            key={post.id}
                            className={`bg-white rounded-xl border ${post.isPinned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                                } p-6 hover:shadow-md transition-shadow`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    {post.isPinned && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                            Pinned
                                        </span>
                                    )}
                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${post.type === 'announcement'
                                        ? 'bg-purple-100 text-purple-700'
                                        : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {post.type}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isAdmin && (
                                        <button
                                            onClick={() => handleTogglePin(post.id, !post.isPinned)}
                                            className="text-sm text-gray-500 hover:text-blue-600 px-3 py-1 rounded-lg hover:bg-gray-100"
                                        >
                                            {post.isPinned ? 'Unpin' : 'Pin'}
                                        </button>
                                    )}
                                    <Link
                                        to={`/groups/$slug/posts/$postId/edit`}
                                        params={{ slug: slug, postId: post.id }}
                                        className="text-sm text-gray-500 hover:text-gray-900 px-3 py-1 rounded-lg hover:bg-gray-100"
                                    >
                                        Edit
                                    </Link>
                                    <button
                                        onClick={() => {
                                            setDeletingPost(post)
                                            setShowDeleteConfirm(true)
                                        }}
                                        className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>

                            <Link to={`/groups/$slug/posts/$postId`} params={{ slug: slug, postId: post.id }}>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2 hover:text-blue-600">
                                    {post.title}
                                </h3>
                            </Link>

                            <p className="text-gray-600 line-clamp-2 mb-4">
                                {post.content.replace(/[#*`]/g, '').slice(0, 200)}...
                            </p>

                            <div className="flex items-center justify-between text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium text-sm">
                                        {(post.author.name || '未知用户').charAt(0).toUpperCase()}
                                    </div>
                                    <span className="font-medium text-gray-900">{post.author.name}</span>
                                    <span>•</span>
                                    <time dateTime={post.createdAt.toString()}>
                                        {new Date(post.createdAt).toLocaleDateString()}
                                    </time>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                        onClick={() => navigate({
                            to: `/groups/${slug}/posts`,
                            search: { type, page: page - 1, pageSize: pageSize }
                        })}
                        disabled={page <= 1}
                        className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <span className="text-gray-600">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => navigate({
                            to: `/groups/${slug}/posts`,
                            search: { type, page: page + 1, pageSize: pageSize }
                        })}
                        disabled={page >= totalPages}
                        className="px-4 py-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && deletingPost && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Post?</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "{deletingPost.title}"? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    setDeletingPost(null)
                                }}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deletingPost.id)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}