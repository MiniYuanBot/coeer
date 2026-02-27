import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/groups/$slug/posts')({
    component: PostsLayout,
})

function PostsLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Outlet />
        </div>
    )
}