import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/coeer'

export const Route = createFileRoute('/_authed')({
    beforeLoad: ({ context, location }) => {
        if (!context.user) {
            // dub-style gate: bounce to the auth screen and remember the
            // original destination so we can return after login.
            const next = `${location.pathname}${location.search}`
            throw redirect({
                to: '/login',
                search: next !== '/' ? { redirect: next } : {},
            })
        }
    },
    component: AuthedLayout,
})

function AuthedLayout() {
    const { user } = Route.useRouteContext()

    return (
        <AppShell user={user}>
            <Outlet />
        </AppShell>
    )
}
