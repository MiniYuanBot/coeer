import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Alert({
    children,
    tone = 'default',
    className,
}: {
    children: ReactNode
    tone?: 'default' | 'danger' | 'success' | 'warning'
    className?: string
}) {
    return (
        <div
            role={tone === 'danger' ? 'alert' : 'status'}
            className={cn(
                'rounded-md border px-3.5 py-3 text-[13px] leading-6',
                tone === 'default' && 'border-border bg-muted/40 text-muted-foreground',
                tone === 'danger' && 'border-danger/20 bg-danger/5 text-danger',
                tone === 'success' && 'border-success/20 bg-success/5 text-success',
                tone === 'warning' && 'border-warning/20 bg-warning/5 text-warning',
                className,
            )}
        >
            {children}
        </div>
    )
}
