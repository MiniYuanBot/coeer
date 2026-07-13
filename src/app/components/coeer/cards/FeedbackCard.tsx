import { Link } from '@tanstack/react-router'
import type { BadgeTone } from '../lib/types'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function FeedbackCard({ feedback }: { feedback: any }) {
    const tone: BadgeTone = feedback.status === 'resolved'
        ? 'success'
        : feedback.status === 'processing'
            ? 'primary'
            : feedback.status === 'invalid'
                ? 'danger'
                : 'warning'

    return (
        <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="block">
            <Card className="p-5">
                <div className="flex items-center gap-2">
                    <Badge tone={tone}>{feedback.status}</Badge>
                    {feedback.isAnonymous ? <Badge>匿名</Badge> : null}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(feedback.createdAt)}</span>
                </div>
                <h3 className="mt-3 font-semibold">{feedback.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{feedback.content}</p>
            </Card>
        </Link>
    )
}
