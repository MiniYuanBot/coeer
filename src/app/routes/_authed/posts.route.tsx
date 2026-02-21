import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'
import { fetchPosts } from 'src/server/utils/posts.js'

export const Route = createFileRoute('/_authed/posts')({
  loader: () => fetchPosts(),
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  const postsMemo = useMemo(() =>
    [...posts, { id: 'i-do-not-exist', title: 'Non-existent Post' }],
    [posts]
  )

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {postsMemo.map(
          (post) => (
            <li key={post.id} className="whitespace-nowrap">
              <Link
                to="/posts/$postId"
                params={{
                  postId: post.id,
                }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                activeProps={{ className: 'text-black font-bold' }}
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </li>
          ),
        )}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
