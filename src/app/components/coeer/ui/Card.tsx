import * as React from 'react'
import { cn } from '../lib/cn'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return <section className={cn('coeer-card', className)}>{children}</section>
}
