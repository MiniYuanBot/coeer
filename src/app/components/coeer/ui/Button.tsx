import * as React from 'react'
import { cn } from '../lib/cn'
import type { ButtonVariant } from '../lib/types'

export function Button({
    variant = 'primary', size = 'md', loading, asChild, className, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
    loading?: boolean
    asChild?: boolean
}) {
    const classes = cn(
        'coeer-focus coeer-button inline-flex shrink-0 items-center justify-center rounded-md font-medium transition-colors duration-150 disabled:pointer-events-none disabled:border-control-border disabled:bg-muted disabled:text-muted-foreground disabled:hover:bg-muted',
        size === 'xs' ? 'h-7 gap-1.5 px-1.5 text-xs' : 'gap-2 text-[13px]',
        size === 'sm' && 'h-8 px-2.5',
        size === 'md' && 'h-9 px-3.5',
        size === 'lg' && 'h-11 px-5',
        size === 'icon' && 'h-8 w-8',
        variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-hover',
        variant === 'secondary' && 'border border-control-border bg-card text-foreground hover:bg-muted',
        variant === 'outline' && 'border border-control-border bg-transparent text-foreground hover:bg-muted',
        variant === 'ghost' && 'text-muted-foreground hover:bg-muted hover:text-foreground',
        variant === 'danger' && 'bg-danger text-danger-foreground hover:bg-danger-hover',
        className,
    )
    if (asChild && React.isValidElement<{ className?: string }>(children)) {
        return React.cloneElement(children, { ...props, className: cn(classes, children.props.className) })
    }
    return (
        <button type="button" {...props} disabled={props.disabled || loading} aria-busy={loading || undefined} className={classes}>
            {loading ? <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
        </button>
    )
}
