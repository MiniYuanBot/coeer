import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Width follows the task: collections use the canvas, writing keeps a readable measure. */
export function PageLayout({ width = 'full', className, ...props }: HTMLAttributes<HTMLDivElement> & {
    width?: 'full' | 'reading' | 'form'
}) {
    return <div {...props} data-width={width} className={cn('coeer-page', className)} />
}
