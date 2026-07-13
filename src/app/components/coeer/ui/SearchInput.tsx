import * as React from 'react'
import { cn } from '../lib/cn'
import { Icon } from './Icon'

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
                {...props}
                className={cn(
                    'coeer-focus h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                    props.className,
                )}
            />
        </label>
    )
}
