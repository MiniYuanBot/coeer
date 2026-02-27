import { createFileRoute, useNavigate, redirect } from '@tanstack/react-router'
import { getFeedbackStatsFn } from '~/functions'

type SearchParams = {
    startDate?: string
    endDate?: string
}

export const Route = createFileRoute('/_authed/admin/stats')({
    validateSearch: (search: Record<string, unknown>): SearchParams => ({
        startDate: (search.startDate as string) || '',
        endDate: (search.endDate as string) || '',
    }),
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
        const result = await getFeedbackStatsFn({
            data: {
                startDate: deps.startDate || undefined,
                endDate: deps.endDate || undefined,
            },
        })
        if (!result) {
            throw new Error('No stat found')
        }
        return result || []
    },
    errorComponent: ({ error }) => {
        if (error.message === 'No stat found') {
            throw redirect({ to: '/admin' })
        }

        throw error
    },
    component: AdminStatsPage,
})

function AdminStatsPage() {
    const stats = Route.useLoaderData()
    const { startDate, endDate } = Route.useSearch()
    const navigate = useNavigate()

    const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        navigate({
            to: '/admin/stats',
            search: {
                startDate: formData.get('startDate') as string,
                endDate: formData.get('endDate') as string,
            },
        })
    }

    return (
        <div className="space-y-6">
            {/* Date Filter */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <form onSubmit={handleFilter} className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            name="startDate"
                            type="date"
                            defaultValue={startDate}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            name="endDate"
                            type="date"
                            defaultValue={endDate}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Filter
                    </button>
                </form>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Total Feedbacks</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Processing</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.processing}</p>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <p className="text-sm text-gray-600 mb-1">Resolved</p>
                    <p className="text-3xl font-bold text-green-600">{stats.resolved}</p>
                </div>
            </div>

            {/* Additional Stats */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Statistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <p className="text-sm text-gray-600 mb-1">Invalid Feedbacks</p>
                        <p className="text-2xl font-semibold text-gray-700">{stats.invalid}</p>
                    </div>
                    {stats.avgResolveTime && (
                        <div>
                            <p className="text-sm text-gray-600 mb-1">Avg. Response Time</p>
                            <p className="text-2xl font-semibold text-gray-700">
                                {stats.avgResolveTime} hours
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}