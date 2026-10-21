import { Link } from '@tanstack/react-router'
import type { BadgeTone } from '../lib/types'
import { formatDate } from '../lib/date'
import { feedbackStatusLabels, feedbackTargetLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

function StatusIcon({ status }: { status: string }) {
    const color = status === 'resolved' ? 'text-success' : status === 'processing' ? 'text-primary' : status === 'invalid' ? 'text-muted-foreground' : 'text-warning'
    return (
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={'h-[18px] w-[18px] shrink-0 ' + color}>
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" strokeDasharray={status === 'pending' ? '3 3' : undefined} />
            {status === 'resolved' ? <path d="m6.5 10 2.3 2.3 4.7-4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
            {status === 'processing' ? <path d="M10 3a7 7 0 0 1 0 14Z" fill="currentColor" /> : null}
            {status === 'invalid' ? <path d="m7.5 7.5 5 5m0-5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : null}
        </svg>
    )
}

export function FeedbackCard({ feedback, variant = 'card' }: { feedback: any; variant?: 'card' | 'row' }) {
    const tone: BadgeTone = feedback.status === 'resolved' ? 'success' : feedback.status === 'processing' ? 'primary' : feedback.status === 'invalid' ? 'danger' : 'warning'
    if (variant === 'row') {
        return (
            <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="coeer-focus group grid grid-cols-[20px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-3 py-3 transition-colors hover:bg-muted/50 sm:grid-cols-[20px_minmax(0,1fr)_84px_64px] sm:items-center sm:px-4">
                <span className="mt-0.5 sm:mt-0"><StatusIcon status={feedback.status} /></span>
                <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium group-hover:text-primary">{feedback.title}</span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:line-clamp-1">{feedback.content}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{feedbackTargetLabels[feedback.targetType] || '综合建议'}</span>
                        {feedback.isAnonymous ? <span className="rounded border border-border px-1">匿名</span> : null}
                        <span className="sm:hidden">{feedbackStatusLabels[feedback.status] || feedback.status}</span>
                        <span className="sm:hidden">{formatDate(feedback.createdAt)}</span>
                    </span>
                </span>
                <span className="hidden sm:block"><Badge tone={tone}>{feedbackStatusLabels[feedback.status] || feedback.status}</Badge></span>
                <span className="hidden text-right text-[11px] text-muted-foreground sm:block">{formatDate(feedback.createdAt)}</span>
            </Link>
        )
    }
    return (
        <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="coeer-focus block rounded-lg">
            <Card className="h-full p-5 transition-colors hover:bg-muted/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2"><StatusIcon status={feedback.status} /><Badge tone={tone}>{feedbackStatusLabels[feedback.status] || feedback.status}</Badge>{feedback.isAnonymous ? <Badge>匿名</Badge> : null}</div>
                    <span className="text-xs text-muted-foreground">{formatDate(feedback.createdAt)}</span>
                </div>
                <h3 className="mt-3 text-sm font-medium">{feedback.title}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-muted-foreground">{feedback.content}</p>
            </Card>
        </Link>
    )
}
