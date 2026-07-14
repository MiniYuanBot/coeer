import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

const tabClass = 'coeer-focus rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]'
const activeClass = 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]'

export const Route = createFileRoute('/_authed/admin/feedbacks')({
    component: AdminFeedbacksLayout,
})

function AdminFeedbacksLayout() {
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                <Link to="/admin/feedbacks" className={tabClass} activeProps={{ className: activeClass }}>
                    全部反馈
                </Link>
                <Link to="/admin/feedbacks/pending" className={tabClass} activeProps={{ className: activeClass }}>
                    待审核
                </Link>
            </div>
            <Outlet />
        </div>
    )
}
