import * as React from 'react'
import { cn } from '../lib/cn'
import type { BadgeTone } from '../lib/types'

export function Badge({ tone = 'default', children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
    return (
        <span className={cn(
            'inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4',
            tone === 'default' && 'border-border bg-muted/50 text-muted-foreground',
            tone === 'primary' && 'border-primary/15 bg-primary-soft text-primary',
            tone === 'success' && 'border-success/15 bg-success/8 text-success',
            tone === 'warning' && 'border-warning/15 bg-warning/8 text-warning',
            tone === 'danger' && 'border-danger/15 bg-danger/8 text-danger',
            tone === 'muted' && 'border-transparent bg-transparent text-muted-foreground',
            className,
        )}>{children}</span>
    )
}
