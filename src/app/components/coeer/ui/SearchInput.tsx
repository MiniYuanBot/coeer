import * as React from 'react'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label className="relative block min-w-0 flex-1">
            <span className="sr-only">{props['aria-label'] || props.placeholder || '搜索'}</span>
            <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input type="search" {...props} className={cn('coeer-focus h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground', props.className)} />
        </label>
    )
}
