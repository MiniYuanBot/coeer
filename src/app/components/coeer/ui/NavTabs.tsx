import type { ReactNode } from 'react'

/** Route links use the same spacing and focus rules in community and service pages. */
export function NavTabs({ children, label }: { children: ReactNode; label: string }) {
    return (
        <nav aria-label={label} className="coeer-tabs coeer-scrollbar flex min-w-0 gap-5 overflow-x-auto border-b border-border">
            {children}
        </nav>
    )
}

export const navTabClass =
    'coeer-focus coeer-tab relative inline-flex shrink-0 items-center gap-2 border-b-2 px-0.5 pb-3 pt-1 text-[13px]'
export const activeNavTabClass = 'border-primary font-medium text-foreground'
