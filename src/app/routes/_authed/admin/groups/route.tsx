import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/groups')({
    component: AdminGroupsLayout,
})

function AdminGroupsLayout() {
    return <Outlet />
}
