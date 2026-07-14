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
                tone === 'success' && 'border-[hsl(var(--primary)/0.24)] bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]',
                tone === 'warning' && 'border-[hsl(var(--primary)/0.18)] bg-[hsl(var(--primary)/0.07)] text-[hsl(var(--foreground))]',
                tone === 'danger' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
                tone === 'muted' && 'border-transparent bg-transparent text-[hsl(var(--muted-foreground))]',
                className,
            )}
        >
            {children}
        </span>
    )
}
