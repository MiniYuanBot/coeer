import type { ReactNode } from 'react'

/** Route links use the same spacing and focus rules in community and service pages. */
export function NavTabs({ children, label }: { children: ReactNode; label: string }) {
    return (
        <nav aria-label={label} className="flex min-w-0 gap-1 overflow-x-auto border-b border-border pb-3">
            {children}
        </nav>
    )
}

export const navTabClass =
    'coeer-focus shrink-0 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground'
export const activeNavTabClass = 'bg-muted font-medium text-foreground'
