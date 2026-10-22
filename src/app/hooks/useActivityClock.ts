import { useEffect, useState } from 'react'

/** Keep open activity pages current at time boundaries, without requiring a reload. */
export function useActivityClock() {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const refresh = () => setNow(Date.now())
        const interval = window.setInterval(refresh, 1000)
        window.addEventListener('focus', refresh)
        return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh) }
    }, [])
    return now
}
