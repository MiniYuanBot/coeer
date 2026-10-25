import type { ReactNode } from 'react'

/** Route links use the same spacing and focus rules in community and service pages. */
export function NavTabs({ children, label }: { children: ReactNode; label: string }) {
    return (
        <nav aria-label={label} className={viewTabsClass}>
            {children}
        </nav>
    )
}

export const navTabClass =
    'coeer-focus coeer-tab relative inline-flex shrink-0 items-center gap-2 border-b-2 px-0.5 text-[13px]'
export const activeNavTabClass = 'border-primary font-medium text-foreground'
export const viewTabsClass = 'coeer-tabs coeer-scope-tabs coeer-scrollbar'

/** Query-based views remain pressed buttons, separate from condition filters. */
export function ViewTabs({ label, items }: { label: string; items: Array<{ key: string; label: string; active?: boolean; onClick: () => void }> }) {
    return <div role="group" aria-label={label} className={viewTabsClass}>
        {items.map(item => <button key={item.key} type="button" onClick={item.onClick} aria-pressed={!!item.active}
            data-status={item.active ? 'active' : undefined} className={navTabClass}>{item.label}</button>)}
    </div>
}
