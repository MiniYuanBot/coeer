import * as React from 'react'
import { cn } from '../lib/cn'
import type { BadgeTone } from '../lib/types'

export function Badge({ tone = 'default', children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                tone === 'default' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
                tone === 'primary' && 'border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]',
                tone === 'success' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                tone === 'warning' && 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
                tone === 'danger' && 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
                tone === 'muted' && 'border-transparent bg-transparent text-[hsl(var(--muted-foreground))]',
                className,
            )}
        >
            {children}
        </span>
    )
}
