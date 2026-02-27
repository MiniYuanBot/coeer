import { createFileRoute, Link, useNavigate, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { deleteGroupPostFn, togglePinPostFn } from '~/functions'

export const Route = createFileRoute('/_authed/groups/$slug/posts/$postId/')({
  component: PostIndexComponent,
})

function PostIndexComponent() {
  const { group, post } = Route.useRouteContext()
  const { slug, postId } = Route.useParams()
  const navigate = useNavigate()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false) // Should come from auth context

  const handleDelete = async () => {
    await deleteGroupPostFn({ data: { id: postId } })
    navigate({ to: `/groups/${slug}/posts` })
  }

  const handleTogglePin = async () => {
    await togglePinPostFn({ data: { id: postId, isPinned: !post.isPinned } })
    navigate({ to: `/groups/${slug}/posts/${postId}` })
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to={`/groups/$slug`} params={{ slug: slug }} className="hover:text-gray-900">{group.name}</Link>
        <span>/</span>
        <Link to={`/groups/$slug/posts`} params={{ slug: slug }} className="hover:text-gray-900">Posts</Link>
        <span>/</span>
        <span className="text-gray-900 truncate max-w-xs">{post.title}</span>
      </div>

      {/* Post Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-8 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {post.isPinned && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                Pinned
              </span>
            )}
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${post.type === 'announcement'
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-700'
              }`}>
              {post.type}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleTogglePin}
                className="text-sm text-gray-500 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-gray-100"
              >
                {post.isPinned ? 'Unpin Post' : 'Pin Post'}
              </button>
            )}
            <Link
              to={`/groups/$slug/posts/$postId/edit`}
              params={{ slug: slug, postId: postId }}
              className="text-sm text-gray-500 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100"
            >
              Edit
            </Link>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-6">{post.title}</h1>

        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-100">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-medium">
            {(post.author.name || '未知用户').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-gray-900">{post.author.name}</p>
            <p className="text-sm text-gray-500">
              <time dateTime={post.createdAt.toString()}>
                {new Date(post.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
              {post.updatedAt !== post.createdAt && ' (edited)'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="prose prose-gray max-w-none">
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {post.content}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          to={`/groups/$slug/posts`}
          params={{ slug: slug }}
          className="text-gray-600 hover:text-gray-900 font-medium"
        >
          ← Back to posts
        </Link>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Post?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{post.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
