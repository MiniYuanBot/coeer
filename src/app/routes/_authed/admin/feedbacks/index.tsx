import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn, updateFeedbackStatusFn, deleteFeedbackFn } from '~/functions'
import { FeedbackStatus, FEEDBACK_STATUS_ARRAY } from '@shared/constants'
import { useState } from 'react'

const searchSchema = z.object({
    status: z.enum(FEEDBACK_STATUS_ARRAY).optional(),
    q: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/admin/feedbacks/')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
        const result = await getFeedbacksFn({
            data: {
                status: deps.status,
                search: deps.q,
                page: deps.page,
                pageSize: 20,
            },
        })
        return { feedbacks: result?.items || [], total: result?.total || 0 }
    },
    component: AdminFeedbacksPage,
})

function AdminFeedbacksPage() {
    const { feedbacks, total } = Route.useLoaderData()
    const { status, q, page } = Route.useSearch()
    const navigate = useNavigate()

    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [showStatusModal, setShowStatusModal] = useState<string | null>(null)

    const totalPages = Math.ceil(total / 20)

    const handleStatusUpdate = async (id: string, newStatus: FeedbackStatus, note?: string) => {
        setUpdatingId(id)
        try {
            await updateFeedbackStatusFn({
                data: { id, status: newStatus, note },
            })
            navigate({ to: '/admin/feedbacks', search: { status, q, page } })
        } finally {
            setUpdatingId(null)
            setShowStatusModal(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return

        setDeletingId(id)
        try {
            await deleteFeedbackFn({ data: { id } })
            navigate({ to: '/admin/feedbacks', search: { status, q, page } })
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            defaultValue={q}
                            placeholder="Search feedbacks..."
                            onChange={(e) => {
                                const value = e.target.value
                                clearTimeout((window as any).searchTimeout)
                                    ; (window as any).searchTimeout = setTimeout(() => {
                                        navigate({ to: '/admin/feedbacks', search: { status, q: value, page: 1 } })
                                    }, 300)
                            }}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <select
                        value={status || ''}
                        onChange={(e) => navigate({
                            to: '/admin/feedbacks',
                            search: { status: e.target.value as FeedbackStatus || undefined, q, page: 1 }
                        })}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="resolved">Resolved</option>
                        <option value="invalid">Invalid</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Author</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {feedbacks.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    No feedbacks found
                                </td>
                            </tr>
                        ) : (
                            feedbacks.map((feedback) => (
                                <tr key={feedback.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <Link
                                            to="/feedbacks/$feedbackId"
                                            params={{ feedbackId: feedback.id }}
                                            className="font-medium text-gray-900 hover:text-blue-600"
                                        >
                                            {feedback.title}
                                        </Link>
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-1">{feedback.content}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {feedback.isAnonymous ? (
                                            <span className="text-gray-400">Anonymous</span>
                                        ) : (
                                            feedback.author?.name || 'Unknown'
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                feedback.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                                    feedback.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {feedback.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(feedback.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => setShowStatusModal(feedback.id)}
                                            disabled={updatingId === feedback.id}
                                            className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                                        >
                                            Update
                                        </button>
                                        <button
                                            onClick={() => handleDelete(feedback.id)}
                                            disabled={deletingId === feedback.id}
                                            className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                                        >
                                            {deletingId === feedback.id ? 'Deleting...' : 'Delete'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => navigate({ to: '/admin/feedbacks', search: { status, q, page: page - 1 } })}
                        disabled={page <= 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-600">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => navigate({ to: '/admin/feedbacks', search: { status, q, page: page + 1 } })}
                        disabled={page >= totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Status Update Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Status</h3>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault()
                                const formData = new FormData(e.currentTarget)
                                handleStatusUpdate(
                                    showStatusModal,
                                    formData.get('status') as FeedbackStatus,
                                    formData.get('note') as string
                                )
                            }}
                            className="space-y-4"
                        >
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                                <select
                                    name="status"
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="processing">Processing</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="invalid">Invalid</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                                <textarea
                                    name="note"
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Add a note about this status change..."
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowStatusModal(null)}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingId === showStatusModal}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {updatingId === showStatusModal ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}