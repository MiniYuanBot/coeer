import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Workspace pages fill the canvas; readable measures belong inside their sections. */
export function PageLayout({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
    return <div {...props} className={cn('coeer-page', className)} />
}
