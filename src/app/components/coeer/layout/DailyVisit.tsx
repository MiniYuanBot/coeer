import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { recordDailyVisitFn } from '~/functions/points'
import { createDailyVisitRecorder } from '@/lib/daily-visit'

const record = createDailyVisitRecorder(() => recordDailyVisitFn())

export function DailyVisit({ userId }: { userId?: string }) {
    const router = useRouter()
    useEffect(() => {
        if (!userId) return
        let disposed = false
        const visit = () => {
            if (document.visibilityState !== 'visible') return
            void record(userId).then(awarded => {
                // Refresh point totals after a new award, without blocking navigation.
                if (awarded && !disposed) return router.invalidate()
            }).catch(error => console.error('Daily activity reward failed:', error))
        }
        const start = setTimeout(visit, 0)
        const timer = setInterval(visit, 60000)
        document.addEventListener('visibilitychange', visit)
        return () => {
            disposed = true
            clearTimeout(start)
            clearInterval(timer)
            document.removeEventListener('visibilitychange', visit)
        }
    }, [userId, router])
    return null
}
