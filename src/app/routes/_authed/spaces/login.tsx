import { createFileRoute, redirect } from '@tanstack/react-router'
export const Route = createFileRoute('/_authed/spaces/login')({
    beforeLoad: ({ search }) => {
        throw redirect({ to: '/spaces/identity', search: { next: search.next } })
    },
})
