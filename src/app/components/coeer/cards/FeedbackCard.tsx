import { Link } from '@tanstack/react-router'
import type { BadgeTone } from '../lib/types'
import { formatDate } from '../lib/date'
import { feedbackStatusLabels } from '../lib/labels'
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
            <Card className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border))] hover:shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                    <Badge tone={tone}>{feedbackStatusLabels[feedback.status] || feedback.status}</Badge>
                    {feedback.isAnonymous ? <Badge>匿名</Badge> : null}
                    </div>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(feedback.createdAt)}</span>
                </div>
                <h3 className="mt-3 text-[15px] font-medium">{feedback.title}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{feedback.content}</p>
            </Card>
        </Link>
    )
}
