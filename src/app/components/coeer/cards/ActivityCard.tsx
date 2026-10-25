import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { formatDate, formatDateTime } from '../lib/date'
import { activityStatusLabels } from '../lib/labels'
import type { BadgeTone } from '../lib/types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { MarkdownSummary } from '../ui/Markdown'
import { activityStatusAt } from '@shared/activities'
import { useActivityClock } from '@/hooks/useActivityClock'

export function ActivityCard({ activity, action }: { activity: any; action?: React.ReactNode }) {
    activity = { ...activity, status: activityStatusAt(activity, useActivityClock()) }
    const statusTone: BadgeTone = activity.status === 'ongoing'
        ? 'success'
        : activity.status === 'completed' || activity.status === 'cancelled'
            ? 'default'
            : 'primary'

    return (
        <Card className="coeer-linked-card flex h-full min-w-0 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
                <Badge tone={statusTone}>{activityStatusLabels[activity.status] || activity.status}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(activity.startTime)}</span>
            </div>
            <h3 className="mt-3 text-[15px] font-medium leading-6"><Link to="/activities/$activityId" params={{ activityId: activity.id }} className="coeer-card-link rounded hover:text-primary">{activity.title}</Link></h3>
            <MarkdownSummary content={activity.description} className="mt-2 text-muted-foreground" />
            <div className="mt-4 grid gap-2 text-[13px] text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-2"><Icon name="calendar" /> {formatDateTime(activity.startTime)}</span>
                <span className="inline-flex items-center gap-2"><Icon name="bookmark" /> {activity.location || '待定地点'}</span>
            </div>
            {action ? <div className="coeer-card-action mt-auto pt-5">{action}</div> : null}
        </Card>
    )
}
