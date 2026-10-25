import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { navTabClass, viewTabsClass } from './NavTabs'

/** Keep existing forms mounted while making the record list reachable before editing. */
export function EditorSection({ title, listTitle, records, editKey, resetKey, attention, children }: {
    title: string; listTitle: string; records: ReactNode; editKey?: string; resetKey?: number; attention?: boolean; children: ReactNode
}) {
    const [expanded, setExpanded] = useState(false)
    const id = useId()
    const trigger = useRef<HTMLButtonElement>(null)
    const previous = useRef({ editKey, resetKey })
    useEffect(() => {
        if (previous.current.resetKey !== resetKey || (previous.current.editKey && !editKey)) setExpanded(false)
        if (editKey || attention) {
            setExpanded(true)
            trigger.current?.focus({ preventScroll: true })
            trigger.current?.scrollIntoView({ block: 'start' })
        }
        previous.current = { editKey, resetKey }
    }, [editKey, resetKey, attention])
    return <section className="coeer-editor-section">
        <div role="group" aria-label="管理视图" className={viewTabsClass}>
            <button type="button" className={navTabClass} aria-pressed={!expanded} data-status={!expanded ? 'active' : undefined}
                aria-controls={`${id}-records`} onClick={() => setExpanded(false)}>{listTitle}</button>
            <button ref={trigger} type="button" className={navTabClass} aria-pressed={expanded} data-status={expanded ? 'active' : undefined}
                aria-controls={id} onClick={() => setExpanded(true)}>{title}</button>
        </div>
        <div id={id} hidden={!expanded} className="coeer-editor-body coeer-admin-form">{children}</div>
        <div id={`${id}-records`} hidden={expanded} className="coeer-editor-records">{records}</div>
    </section>
}
