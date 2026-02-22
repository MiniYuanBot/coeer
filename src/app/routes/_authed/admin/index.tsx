import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/')({
    component: AdminIndexComponent,
})

function AdminIndexComponent() {
    const { user } = Route.useRouteContext()

    if (!user) {
        return null
    }

    return (
        <p>Welcome to the world of POWER!!!</p>
    )
}