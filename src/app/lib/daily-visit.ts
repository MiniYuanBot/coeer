import { engagementDay } from '@shared/constants/engagement'

type VisitResult = { userId: string; day: string; awarded: boolean } | null

/** A browser-only hint; PostgreSQL remains the authority for awarding points. */
export function createDailyVisitRecorder(record: () => Promise<VisitResult>) {
    let completed = ''
    let pending: { key: string; promise: Promise<boolean> } | undefined
    return (userId: string, now = new Date()): Promise<boolean> => {
        const key = `${userId}:${engagementDay(now).day}`
        if (completed === key) return Promise.resolve(false)
        if (pending?.key === key) return pending.promise
        const task = record().then(result => {
            if (!result || result.userId !== userId) return false
            completed = `${userId}:${result.day}`
            return result.awarded
        }).finally(() => { if (pending?.promise === task) pending = undefined })
        pending = { key, promise: task }
        return task
    }
}
