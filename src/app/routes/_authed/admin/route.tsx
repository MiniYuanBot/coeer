import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin')({
    beforeLoad: ({ context }) => {
        if (context.user?.role !== 'admin') {
            throw redirect({ to: '/' })
        }
    },
    component: Outlet,
})
