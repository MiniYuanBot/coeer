import * as React from 'react'
import { cn } from '../lib/cn'
import type { BadgeTone } from '../lib/types'

export function Badge({ tone = 'default', children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
    return (
        <span className={cn(
            'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium leading-[18px]',
            tone === 'default' && 'border-border bg-muted text-muted-foreground',
            tone === 'primary' && 'border-primary/15 bg-primary-soft text-primary',
            tone === 'success' && 'border-success/25 bg-success-soft text-success',
            tone === 'warning' && 'border-warning/25 bg-warning-soft text-warning',
            tone === 'danger' && 'border-danger/25 bg-danger-soft text-danger',
            tone === 'muted' && 'border-transparent bg-muted text-muted-foreground',
            className,
        )}>{children}</span>
    )
}
