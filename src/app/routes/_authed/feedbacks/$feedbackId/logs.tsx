import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbackStatusLogsFn } from '~/functions'

const searchSchema = z.object({
    page: z.number().default(1),
})

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId/logs')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: async ({ params, deps }) => {
        const result = await getFeedbackStatusLogsFn({
            data: {
                feedbackId: params.feedbackId,
                page: deps.page,
                pageSize: 20,
            },
        })
        return { logs: result?.items || [], total: result?.total || 0 }
    },
    component: FeedbackLogsPage,
})

function FeedbackLogsPage() {
    const { logs, total } = Route.useLoaderData()
    const { feedbackId } = Route.useParams()
    const { page } = Route.useSearch()
    const navigate = useNavigate()

    const totalPages = Math.ceil(total / 20)

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Status Change History</h2>
                    <Link
                        to="/feedbacks/$feedbackId"
                        params={{ feedbackId }}
                        className="text-sm text-blue-600 hover:text-blue-700"
                    >
                        Back to Detail
                    </Link>
                </div>
            </div>

            <div className="divide-y divide-gray-200">
                {logs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No status change logs found
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${log.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                log.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                                    log.status === 'resolved' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {log.status}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </span>
                                    </div>

                                    {log.note && (
                                        <p className="text-gray-700 mb-2">{log.note}</p>
                                    )}

                                    {log.changedBy && (
                                        <p className="text-sm text-gray-500">
                                            Changed by: {log.changedBy.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {totalPages > 1 && (
                <div className="p-4 border-t border-gray-200 flex items-center justify-center gap-2">
                    <button
                        onClick={() => navigate({
                            to: '/feedbacks/$feedbackId/logs',
                            params: { feedbackId },
                            search: { page: page - 1 }
                        })}
                        disabled={page <= 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-4 py-2 text-gray-600">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => navigate({
                            to: '/feedbacks/$feedbackId/logs',
                            params: { feedbackId },
                            search: { page: page + 1 }
                        })}
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