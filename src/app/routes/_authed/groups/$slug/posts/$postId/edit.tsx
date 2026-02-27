import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { updateGroupPostFn } from '~/functions'


export const Route = createFileRoute(
    '/_authed/groups/$slug/posts/$postId/edit',
)({
    component: EditPostPage,
})

function EditPostPage() {
    const { group, post } = Route.useRouteContext()
    const { slug, postId } = Route.useParams()
    const navigate = useNavigate()

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const title = formData.get('title') as string
        const content = formData.get('content') as string

        try {
            await updateGroupPostFn({
                data: {
                    id: postId,
                    title,
                    content,
                }
            })
            navigate({ to: `/groups/${slug}/posts/${postId}` })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update post')
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Post</h1>
                <p className="text-gray-600">Update your post in {group.name}</p>
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
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg text-gray-600">
                        <span className="capitalize">{post.type}</span>
                        <span className="text-xs text-gray-400">(Cannot be changed)</span>
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
                        defaultValue={post.title}
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
                        defaultValue={post.content}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y font-mono text-sm"
                    />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => navigate({ to: `/groups/${slug}/posts/${postId}` })}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    )
}
