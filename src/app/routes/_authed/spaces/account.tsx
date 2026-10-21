import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authed/spaces/account')({
    beforeLoad: () => {
        throw redirect({ to: '/profile' })
    },
})
