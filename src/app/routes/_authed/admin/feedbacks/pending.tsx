import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn, updateFeedbackStatusFn } from '~/functions'
import { FeedbackStatus } from '@shared/constants'
import { useState } from 'react'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/feedbacks/pending')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
        const result = await getFeedbacksFn({
            data: {
                status: 'pending' as FeedbackStatus,
                page: deps.page,
                pageSize: 20,
            },
        })
        return { feedbacks: result?.items || [], total: result?.total || 0 }
    },
    component: AdminPendingFeedbacksPage,
})

function AdminPendingFeedbacksPage() {
    const { feedbacks, total } = Route.useLoaderData()
    const { page } = Route.useSearch()
    const navigate = useNavigate()

    const [processingId, setProcessingId] = useState<string | null>(null)

    const totalPages = Math.ceil(total / 20)

    const handleQuickProcess = async (id: string) => {
        setProcessingId(id)
        try {
            await updateFeedbackStatusFn({
                data: { id, status: 'processing' as FeedbackStatus, note: 'Marked as processing from pending list' },
            })
            navigate({ to: '/admin/feedbacks/pending', search: { page } })
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                    <span className="font-semibold">{total}</span> feedbacks awaiting review
                </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {feedbacks.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <p className="text-lg mb-2">No pending feedbacks</p>
                        <p className="text-sm">All caught up!</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {feedbacks.map((feedback) => (
                            <div key={feedback.id} className="p-6 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                                                Pending
                                            </span>
                                            {feedback.isAnonymous && (
                                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                                                    Anonymous
                                                </span>
                                            )}
                                            <span className="text-sm text-gray-500">
                                                {new Date(feedback.createdAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <Link
                                            to="/feedbacks/$feedbackId"
                                            params={{ feedbackId: feedback.id }}
                                            className="block group mb-2"
                                        >
                                            <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600">
                                                {feedback.title}
                                            </h3>
                                        </Link>

                                        <p className="text-gray-600 line-clamp-2 mb-3">{feedback.content}</p>

                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                            <span>Target: {feedback.targetType}</span>
                                            {feedback.targetDesc && <span>- {feedback.targetDesc}</span>}
                                            {!feedback.isAnonymous && feedback.author && (
                                                <span>By: {feedback.author.name}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleQuickProcess(feedback.id)}
                                            disabled={processingId === feedback.id}
                                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                                        >
                                            {processingId === feedback.id ? 'Processing...' : 'Start Processing'}
                                        </button>
                                        <Link
                                            to="/feedbacks/$feedbackId"
                                            params={{ feedbackId: feedback.id }}
                                            className="px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            View Details
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => navigate({ to: '/admin/feedbacks/pending', search: { page: page - 1 } })}
                        disabled={page <= 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-600">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => navigate({ to: '/admin/feedbacks/pending', search: { page: page + 1 } })}
                        disabled={page >= totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    )
}