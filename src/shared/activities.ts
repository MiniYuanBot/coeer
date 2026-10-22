import type { ActivityStatus } from './constants/activities'

/** Terminal administrative states are preserved; time-based states only move forward. */
export function activityStatusAt(activity: { status: ActivityStatus; startTime: Date | string; endTime: Date | string }, now = Date.now()): ActivityStatus {
    if (activity.status === 'cancelled' || activity.status === 'completed') return activity.status
    if (new Date(activity.endTime).getTime() <= now) return 'completed'
    if (new Date(activity.startTime).getTime() <= now) return 'ongoing'
    return activity.status
}
