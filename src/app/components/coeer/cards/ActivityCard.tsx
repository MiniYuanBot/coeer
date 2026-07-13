import * as React from 'react'
import { formatDate, formatDateTime } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function ActivityCard({ activity, action }: { activity: any; action?: React.ReactNode }) {
    return (
        <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
                <Badge tone={activity.status === 'completed' ? 'success' : 'primary'}>{activity.status}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(activity.startTime)}</span>
            </div>
            <h3 className="mt-3 font-semibold">{activity.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{activity.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-2"><Icon name="calendar" /> {formatDateTime(activity.startTime)}</span>
                <span className="inline-flex items-center gap-2"><Icon name="bookmark" /> {activity.location || '待定地点'}</span>
            </div>
            {action ? <div className="mt-5">{action}</div> : null}
        </Card>
    )
}
