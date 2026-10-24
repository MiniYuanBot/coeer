import * as React from 'react'
import { Icon } from './Icon'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="coeer-surface-reading flex min-h-56 flex-col items-center justify-center px-5 py-12 text-center">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg border border-border bg-muted text-muted-foreground">
                <Icon name="inbox" className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-medium">{title}</h3>
            {description ? <p className="mt-2 max-w-sm text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </div>
    )
}
