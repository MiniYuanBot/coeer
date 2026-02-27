import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createFeedbackFn } from '~/functions'
import { FeedbackTargetType } from '@shared/constants'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/feedbacks/create')({
    component: CreateFeedbackPage,
})

function CreateFeedbackPage() {
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        const formData = new FormData(e.currentTarget)
        // const images = formData.get('images') as string
        // const imageUrls = images ? images.split(',').map(url => url.trim()).filter(Boolean) : []

        try {
            const result = await createFeedbackFn({
                data: {
                    targetType: formData.get('targetType') as FeedbackTargetType,
                    targetDesc: formData.get('targetDesc') as string || undefined,
                    title: formData.get('title') as string,
                    content: formData.get('content') as string,
                    isAnonymous: formData.get('isAnonymous') === 'on',
                    // images: imageUrls,
                },
            })

            if (!result) {
                throw new Error('Failed to create feedback')
            }

            navigate({ to: '/feedbacks' })
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit feedback')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Submit Feedback</h2>

                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Target Type *
                        </label>
                        <select
                            name="targetType"
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select target type</option>
                            <option value="group">Group</option>
                            <option value="event">Event</option>
                            <option value="user">User</option>
                            <option value="system">System</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Target Description
                        </label>
                        <input
                            name="targetDesc"
                            type="text"
                            placeholder="e.g., Group name, Event title, etc."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title *
                        </label>
                        <input
                            name="title"
                            type="text"
                            required
                            maxLength={200}
                            placeholder="Brief summary of your feedback"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Content *
                        </label>
                        <textarea
                            name="content"
                            required
                            rows={6}
                            maxLength={5000}
                            placeholder="Detailed description of your feedback..."
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Images (URLs, comma separated)
                        </label>
                        <input
                            name="images"
                            type="text"
                            placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            name="isAnonymous"
                            type="checkbox"
                            id="isAnonymous"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="isAnonymous" className="text-sm text-gray-700">
                            Submit anonymously
                        </label>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => navigate({ to: '/feedbacks' })}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}