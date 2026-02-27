import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbacksFn } from '~/functions'
import { FeedbackStatus, FEEDBACK_STATUS_ARRAY } from '@shared/constants'
import { useState } from 'react'

const searchSchema = z.object({
    status: z.enum(FEEDBACK_STATUS_ARRAY).optional(),
    q: z.string().optional(),
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/feedbacks/')({
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
  component: FeedbacksListPage,
})

function FeedbacksListPage() {
  const { feedbacks, total } = Route.useLoaderData()
  const { status, q, page } = Route.useSearch()
  const navigate = useNavigate()

  const [deletingId, setDeletingId] = useState<string | null>(null)

  const totalPages = Math.ceil(total / 20)

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const q = formData.get('search') as string
    navigate({ to: '/feedbacks', search: { status, q: q, page: 1 } })
  }

  const handleStatusChange = (newStatus: FeedbackStatus | undefined) => {
    navigate({ to: '/feedbacks', search: { status: newStatus, q, page: 1 } })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this feedback?')) return

    setDeletingId(id)
    try {
      await fetch(`/api/feedbacks/${id}`, { method: 'DELETE' })
      navigate({ to: '/feedbacks', search: { status, q, page } })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="flex gap-2">
              <input
                name="search"
                type="text"
                defaultValue={q}
                placeholder="Search feedbacks..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Search
              </button>
            </div>
          </form>

          <select
            value={status || ''}
            onChange={(e) => handleStatusChange(e.target.value as FeedbackStatus || undefined)}
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

      {/* List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {feedbacks.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg mb-2">No feedbacks found</p>
            <p className="text-sm">Submit your first feedback to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${feedback.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          feedback.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            feedback.status === 'resolved' ? 'bg-green-100 text-green-800' :
                              'bg-gray-100 text-gray-800'
                        }`}>
                        {feedback.status}
                      </span>
                      {feedback.isAnonymous && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Anonymous
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <Link
                      to="/feedbacks/$feedbackId"
                      params={{ feedbackId: feedback.id }}
                      className="block group"
                    >
                      <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600 mb-1">
                        {feedback.title}
                      </h3>
                      <p className="text-gray-600 line-clamp-2">{feedback.content}</p>
                    </Link>
                    <div className="mt-2 text-sm text-gray-500">
                      Target: {feedback.targetType}
                      {feedback.targetDesc && ` - ${feedback.targetDesc}`}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(feedback.id)}
                    disabled={deletingId === feedback.id}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                  >
                    {deletingId === feedback.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => navigate({ to: '/feedbacks', search: { status, q, page: page - 1 } })}
            disabled={page <= 1}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => navigate({ to: '/feedbacks', search: { status, q, page: page + 1 } })}
            disabled={page >= totalPages}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}