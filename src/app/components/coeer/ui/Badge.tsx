import * as React from 'react'
import { cn } from '../lib/cn'
import type { BadgeTone } from '../lib/types'

export function Badge({ tone = 'default', children, className }: { tone?: BadgeTone; children: React.ReactNode; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                tone === 'default' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
                tone === 'primary' && 'border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.09)] text-[hsl(var(--primary))]',
                tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
                tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
                tone === 'danger' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
                tone === 'muted' && 'border-transparent bg-transparent text-[hsl(var(--muted-foreground))]',
                className,
            )}
        >
            {children}
        </span>
    )
}
