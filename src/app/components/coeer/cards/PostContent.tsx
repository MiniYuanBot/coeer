import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { cn } from '../lib/cn'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { Markdown } from '../ui/Markdown'

/** Lists preview long posts; detail pages keep the complete Markdown body. */
export function PostContent({ content, className, collapsedHeight = 168 }: {
    content: string
    className?: string
    collapsedHeight?: number
}) {
    const id = useId()
    const viewport = useRef<HTMLDivElement>(null)
    const body = useRef<HTMLDivElement>(null)
    const [expanded, setExpanded] = useState(false)
    const [overflow, setOverflow] = useState(false)

    useEffect(() => {
        setExpanded(false)
        const measure = () => setOverflow((body.current?.getBoundingClientRect().height ?? 0) > collapsedHeight + 1)
        measure()
        const observer = new ResizeObserver(measure)
        if (body.current) observer.observe(body.current)
        return () => observer.disconnect()
    }, [content, collapsedHeight])

    function toggle() {
        if (expanded && viewport.current && viewport.current.getBoundingClientRect().top < 72) {
            viewport.current.scrollIntoView({ block: 'start' })
        }
        setExpanded(!expanded)
    }

    return <div className={cn('coeer-post-content min-w-0', className)}>
        <div id={id} ref={viewport} className="coeer-post-content-viewport"
            style={{ '--post-preview-height': `${collapsedHeight}px` } as CSSProperties}
            data-collapsed={!expanded || undefined} data-overflow={overflow || undefined}
            onFocusCapture={() => { if (overflow) setExpanded(true) }}>
            <div ref={body} className="flow-root"><Markdown content={content} /></div>
        </div>
        {overflow ? <Button variant="ghost" size="sm" className="mt-1 px-0 text-primary hover:bg-transparent"
            aria-expanded={expanded} aria-controls={id} onClick={toggle}>
            {expanded ? '收起' : '展开全文'}<Icon name="chevron" className={expanded ? 'h-3.5 w-3.5 -rotate-90' : 'h-3.5 w-3.5 rotate-90'} />
        </Button> : null}
    </div>
}
