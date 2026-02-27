import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { getFeedbackByIdFn, deleteFeedbackFn } from '~/functions'
import { useState } from 'react'

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId/')({
    loader: async ({ params }) => {
        const result = await getFeedbackByIdFn({
            data: { id: params.feedbackId },
        })
        if (!result) {
            throw new Error('Feedback not found')
        }
        return result
    },
    errorComponent: ({ error }) => {
        if (error.message === 'Feedback not found') {
            throw redirect({to: '/feedbacks'})
        }

        throw error
    },
    component: FeedbackDetailPage,
})

function FeedbackDetailPage() {
    const feedback = Route.useLoaderData()
    const navigate = useNavigate()
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this feedback?')) return

        setIsDeleting(true)
        try {
            await deleteFeedbackFn({ data: { id: feedback.id } })
            navigate({ to: '/feedbacks' })
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                feedback.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    feedback.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                        'bg-gray-100 text-gray-800'
                            }`}>
                            {feedback.status}
                        </span>
                        {feedback.isAnonymous && (
                            <span className="px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                                Anonymous
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Link
                            to="/feedbacks/$feedbackId/logs"
                            params={{ feedbackId: feedback.id }}
                            className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                            View Logs
                        </Link>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                    </div>
                </div>

                <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                    {feedback.title}
                </h1>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Target: {feedback.targetType}</span>
                    {feedback.targetDesc && <span>- {feedback.targetDesc}</span>}
                    <span>•</span>
                    <span>{new Date(feedback.createdAt).toLocaleString()}</span>
                </div>
            </div>

            <div className="p-6">
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {feedback.content}
                </div>

                {/* {feedback.images && feedback.images.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Attachments</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {feedback.images.map((url, idx) => (
                                <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block aspect-square bg-gray-100 rounded-lg overflow-hidden hover:opacity-75 transition-opacity"
                                >
                                    <img
                                        src={url}
                                        alt={`Attachment ${idx + 1}`}
                                        className="w-full h-full object-cover"
                                    />
                                </a>
                            ))}
                        </div>
                    </div>
                )} */}

                {feedback.author && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                                {feedback.author.name?.[0] || 'U'}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900">{feedback.author.name}</p>
                                <p className="text-sm text-gray-500">Author</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}