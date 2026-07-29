import * as React from 'react'
import type { IconName } from '../lib/types'

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
    const common = {
        className,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.9,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    }

    const paths: Record<IconName, React.ReactNode> = {
        activity: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
        award: <><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
        bookmark: <><path d="M6 3h12v18l-6-4-6 4z" /></>,
        calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="5" width="18" height="16" rx="2" /></>,
        card: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h5" /></>,
        check: <><path d="m5 12 5 5L20 7" /></>,
        chevron: <><path d="m9 18 6-6-6-6" /></>,
        coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
        comment: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
        feedback: <><path d="M4 4h16v12H7l-3 3z" /><path d="M8 8h8M8 12h5" /></>,
        gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18" /><path d="M7.5 8A2.5 2.5 0 1 1 12 5.5V8M16.5 8A2.5 2.5 0 1 0 12 5.5V8" /></>,
        group: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
        heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></>,
        home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
        bed: <><path d="M3 11h18v6H3z" /><path d="M6 11V8a2 2 0 0 1 2-2h3" /><path d="M3 17v4M21 17v4" /></>,
        login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5M15 12H3" /></>,
        logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
        menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
        moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
        send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
        spark: <><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /><path d="M19 15l.7 2.3L22 18l-2.3.7L19 22l-.7-3.3L16 18l2.3-.7z" /></>,
        sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
        user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
        x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    }

    return <svg {...common}>{paths[name]}</svg>
}
