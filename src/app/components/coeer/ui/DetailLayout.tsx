import { useEffect, useRef, type ReactNode } from 'react'

/** Keep the main task readable while giving related information its own column. */
export function DetailLayout({ children, aside, asideLabel = '相关信息', asideFirstOnMobile = false }: {
    children: ReactNode
    aside: ReactNode
    asideLabel?: string
    asideFirstOnMobile?: boolean
}) {
    const ref = useRef<HTMLElement>(null)
    useEffect(() => {
        const aside = ref.current
        if (!aside) return
        const measure = () => { aside.dataset.static = String(aside.getBoundingClientRect().height > window.innerHeight - 108) }
        const observer = new ResizeObserver(measure)
        observer.observe(aside)
        window.addEventListener('resize', measure)
        measure()
        return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
    }, [])
    return <div className="coeer-detail-layout" data-aside-first={asideFirstOnMobile || undefined}>
        <div className="coeer-detail-main min-w-0">{children}</div>
        <aside ref={ref} aria-label={asideLabel} className="coeer-detail-aside min-w-0">{aside}</aside>
    </div>
}
