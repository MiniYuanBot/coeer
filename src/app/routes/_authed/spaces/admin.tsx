import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authed/spaces/admin')({
    beforeLoad: () => {
        throw redirect({ to: '/admin/spaces' })
    },
})
