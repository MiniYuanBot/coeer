import type { ReactNode } from 'react'

/** Keep the main task readable while giving related information its own column. */
export function DetailLayout({ children, aside, asideLabel = '相关信息', asideFirstOnMobile = false }: {
    children: ReactNode
    aside: ReactNode
    asideLabel?: string
    asideFirstOnMobile?: boolean
}) {
    return <div className="coeer-detail-layout" data-aside-first={asideFirstOnMobile || undefined}>
        <div className="coeer-detail-main min-w-0">{children}</div>
        <aside aria-label={asideLabel} className="coeer-detail-aside min-w-0">{aside}</aside>
    </div>
}
