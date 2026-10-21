import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authed/spaces/login')({
    beforeLoad: () => {
        throw redirect({ to: '/spaces' })
    },
})
