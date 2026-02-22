import { createFileRoute } from '@tanstack/react-router'
import { getFeedbacksFn } from '~/functions'

export const Route = createFileRoute('/_authed/feedbacks/')({
  component: FeedbacksIndexComponent,
  loader: async () => {
    const data = await getFeedbacksFn({ data: {} })
    return { feedbacks: data?.feedbacks ?? [], total: data?.total ?? 0 }
  },
})

function FeedbacksIndexComponent() {
  const { feedbacks } = Route.useLoaderData()

  return (
    <div className="space-y-4">
      {feedbacks.map((feedback) => (
        <div key={feedback.id} className="border p-4 rounded-lg">
          <div className="flex justify-between">
            <h3 className="font-semibold">{feedback.title}</h3>
            <span className="text-sm px-2 py-1 bg-gray-100 rounded">
              {feedback.status}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-2">{feedback.targetDesc}</p>
          <p className="mt-2">{feedback.content.substring(0, 100)}...</p>
          <div className="mt-2 text-xs text-gray-400">
            {feedback.isAnonymous ? '匿名用户' : feedback.author?.name} · {new Date(feedback.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  )
}
