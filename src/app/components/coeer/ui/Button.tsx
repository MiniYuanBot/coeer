import * as React from 'react'
import { cn } from '../lib/cn'
import type { ButtonVariant } from '../lib/types'

export function Button({
    variant = 'primary',
    size = 'md',
    loading,
    className,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: 'sm' | 'md' | 'lg' | 'icon'
    loading?: boolean
}) {
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                'coeer-focus inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:pointer-events-none disabled:opacity-55',
                size === 'sm' && 'h-8 px-3',
                size === 'md' && 'h-10 px-4',
                size === 'lg' && 'h-11 px-5',
                size === 'icon' && 'h-10 w-10',
                variant === 'primary' && 'bg-primary text-primary-foreground shadow-sm hover:opacity-90',
                variant === 'secondary' && 'border border-border bg-card text-foreground hover:bg-muted',
                variant === 'outline' && 'border border-border bg-transparent hover:bg-muted',
                variant === 'ghost' && 'hover:bg-muted',
                variant === 'danger' && 'bg-danger text-white hover:opacity-90',
                className,
            )}
        >
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
        </button>
    )
}
