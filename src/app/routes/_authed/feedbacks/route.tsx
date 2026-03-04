import { createFileRoute, Outlet, Link } from '@tanstack/react-router'
import {ButtonLink} from '@/components/ui/Button'


export const Route = createFileRoute('/_authed/feedbacks')({
    component: FeedbacksLayout,
})

function FeedbacksLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-semibold text-gray-900">Feedback Center</h1>
                    <ButtonLink to="/feedbacks/create" > Create Feedback</ButtonLink>
                </div>
                <Outlet />
            </div>
        </div>
    )
}