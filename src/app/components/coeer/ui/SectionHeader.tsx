import * as React from 'react'

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
                <h1 className="text-[28px] font-medium leading-tight tracking-normal text-[hsl(var(--foreground))]">{title}</h1>
                {description ? <p className="mt-2 text-[15px] text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            </div>
            {action}
        </div>
    )
}
