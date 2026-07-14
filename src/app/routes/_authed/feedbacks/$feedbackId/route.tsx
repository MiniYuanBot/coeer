import { createFileRoute, Outlet, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId')({
    component: FeedbackDetailLayout,
})

function FeedbackDetailLayout() {
    return (
        <div className="space-y-6">
            <div className="mb-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <Link to="/feedbacks" className="hover:text-[hsl(var(--primary))]">
                    返回反馈列表
                </Link>
            </div>
            <Outlet />
        </div>
    )
}
