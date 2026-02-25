import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/groups/')({
    loader: () => {
        throw redirect({ to: '/groups/all' })
    },
})