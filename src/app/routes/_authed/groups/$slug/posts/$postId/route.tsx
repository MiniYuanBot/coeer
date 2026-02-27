import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getGroupPostByIdFn } from '~/functions'

export const Route = createFileRoute('/_authed/groups/$slug/posts/$postId')({
    beforeLoad: async ({ params }) => {
        try {
            const post = await getGroupPostByIdFn({ data: { id: params.postId } })
            if (!post) {
                throw redirect({
                    to: '/groups/$slug/posts',
                    params: { slug: params.slug }
                })
            }
            return { post }
        } catch (error) {
            throw error
        }
    },
    errorComponent: ({ error }) => {
        throw error
    },
    component: RouteLayout,
})

function RouteLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Outlet />
        </div>
    )
}
