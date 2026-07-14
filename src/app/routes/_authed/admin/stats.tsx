import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import z from 'zod'
import { getFeedbackStatsFn } from '~/functions'
import { Button, Card, SectionHeader } from '@/components/coeer'

const searchSchema = z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
})

export const Route = createFileRoute('/_authed/admin/stats')({
    validateSearch: searchSchema,
    loaderDeps: ({ search }) => search,
    loader: async ({ deps }) => {
        const result = await getFeedbackStatsFn({
            data: {
                startDate: deps.startDate ? new Date(deps.startDate) : undefined,
                endDate: deps.endDate ? new Date(deps.endDate) : undefined,
            },
        })
        if (!result) {
            throw new Error('No stat found')
        }
        return result
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
                startDate: (formData.get('startDate') as string) || undefined,
                endDate: (formData.get('endDate') as string) || undefined,
            },
        })
    }

    return (
        <div className="space-y-6">
            <SectionHeader title="反馈统计" description="按时间范围查看反馈处理概况。" />

            <Card className="p-4">
                <form onSubmit={handleFilter} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="text-sm font-medium">
                        <span>开始日期</span>
                        <input
                            name="startDate"
                            type="date"
                            defaultValue={startDate}
                            className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                        />
                    </label>
                    <label className="text-sm font-medium">
                        <span>结束日期</span>
                        <input
                            name="endDate"
                            type="date"
                            defaultValue={endDate}
                            className="coeer-focus mt-2 h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
                        />
                    </label>
                    <Button type="submit">筛选</Button>
                </form>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="全部反馈" value={stats.total} />
                <StatCard label="待审核" value={stats.pending} tone="text-amber-600 dark:text-amber-300" />
                <StatCard label="已公开" value={stats.processing} tone="text-[hsl(var(--primary))]" />
                <StatCard label="已解决" value={stats.resolved} tone="text-emerald-600 dark:text-emerald-300" />
            </div>

            <Card className="p-5">
                <h2 className="font-semibold">处理明细</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <StatCard label="已驳回" value={stats.invalid} compact />
                    <StatCard label="平均解决时长" value={`${stats.avgResolveTime || 0} 小时`} compact />
                </div>
            </Card>
        </div>
    )
}

function StatCard({
    label,
    value,
    tone,
    compact,
}: {
    label: string
    value: number | string
    tone?: string
    compact?: boolean
}) {
    return (
        <Card className={compact ? 'p-4' : 'p-5'}>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{label}</p>
            <p className={`mt-2 font-bold ${compact ? 'text-2xl' : 'text-3xl'} ${tone || ''}`}>{value}</p>
        </Card>
    )
}
