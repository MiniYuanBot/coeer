import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/feedbacks')({
    component: AdminFeedbacksLayout,
})

function AdminFeedbacksLayout() {
    return <Outlet />
}
