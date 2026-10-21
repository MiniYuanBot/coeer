import { useEffect, useRef, useState, type ReactNode } from 'react'

export function TableScroll({ label, children }: { label: string; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null)
    const [overflow, setOverflow] = useState(false)
    useEffect(() => {
        const element = ref.current
        if (!element) return
        const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        if (element.firstElementChild) observer.observe(element.firstElementChild)
        return () => observer.disconnect()
    }, [children])
    return <div className="min-w-0">
        <div ref={ref} role="region" aria-label={label} tabIndex={overflow ? 0 : undefined}
            className="coeer-focus coeer-table-scroll">{children}</div>
        {overflow ? <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">左右滚动查看完整表格，可聚焦后使用方向键。</p> : null}
    </div>
}
