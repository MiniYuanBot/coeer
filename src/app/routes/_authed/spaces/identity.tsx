import { createFileRoute, redirect } from '@tanstack/react-router'

// Preserve existing bookmarks without a second identity screen.
export const Route = createFileRoute('/_authed/spaces/identity')({
    beforeLoad() {
        throw redirect({ to: '/spaces' })
    },
})
