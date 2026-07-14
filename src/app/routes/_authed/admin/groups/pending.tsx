import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/groups/pending')({
    loader: () => {
        throw redirect({ to: '/admin/groups', search: { status: 'pending', page: 1 } })
    },
})
