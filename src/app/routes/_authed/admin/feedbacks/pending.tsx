import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/admin/feedbacks/pending')({
    loader: () => {
        throw redirect({ to: '/admin/feedbacks', search: { status: 'pending', page: 1 } })
    },
})
