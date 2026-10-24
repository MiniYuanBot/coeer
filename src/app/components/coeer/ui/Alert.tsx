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
                tone === 'default' && 'border-border bg-muted text-muted-foreground',
                tone === 'danger' && 'border-danger/25 bg-danger-soft text-danger',
                tone === 'success' && 'border-success/25 bg-success-soft text-success',
                tone === 'warning' && 'border-warning/25 bg-warning-soft text-warning',
                className,
            )}
        >
            {children}
        </div>
    )
}
