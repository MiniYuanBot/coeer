import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createGroupPostFn, getGroupBySlugFn } from '~/functions'
import type { GroupPostType } from '@shared/constants'

export const Route = createFileRoute('/_authed/groups/$slug/posts/create')({
    component: CreatePostPage,
})

function CreatePostPage() {
    const { group } = Route.useRouteContext()
    const { slug } = Route.useParams()
    const navigate = useNavigate()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const type = formData.get('type') as GroupPostType
        const title = formData.get('title') as string
        const content = formData.get('content') as string

        try {
            await createGroupPostFn({
                data: {
                    groupId: group.id,
                    type,
                    title,
                    content,
                }
            })
            navigate({ to: `/groups/${slug}/posts` })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create post')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Post</h1>
                <p className="text-gray-600">Share something with {group.name}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-xl border border-gray-200 p-6">
                {error && (
                    <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Post Type
                    </label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="discussion"
                                defaultChecked
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-gray-700">Discussion</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="type"
                                value="announcement"
                                className="w-4 h-4 text-blue-600"
                            />
                            <span className="text-gray-700">Announcement</span>
                            <span className="text-xs text-gray-500">(Admin only)</span>
                        </label>
                    </div>
                </div>

                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                        Title
                    </label>
                    <input
                        type="text"
                        id="title"
                        name="title"
                        required
                        maxLength={200}
                        placeholder="What's this post about?"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                        Content
                    </label>
                    <textarea
                        id="content"
                        name="content"
                        required
                        rows={12}
                        maxLength={10000}
                        placeholder="Write your post content here... (Markdown supported)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y font-mono text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Supports Markdown formatting</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate({ to: `/groups/${slug}/posts` })}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Publishing...' : 'Publish Post'}
                    </button>
                </div>
            </form>
        </div>
    )
}