import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import { Icon, PageLayout } from '@/components/coeer'

export const Route = createFileRoute('/_authed/feedbacks/$feedbackId')({
    component: FeedbackDetailLayout,
})

function FeedbackDetailLayout() {
    return (
        <PageLayout>
            <div>
                <Link to="/feedbacks" className="coeer-focus inline-flex min-h-9 items-center gap-1.5 rounded text-xs text-muted-foreground hover:text-foreground">
                    <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />
                    返回反馈列表
                </Link>
            </div>
            <Outlet />
        </PageLayout>
    )
}
