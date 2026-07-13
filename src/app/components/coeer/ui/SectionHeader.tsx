import * as React from 'react'

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
                <h1 className="text-2xl font-bold tracking-normal md:text-3xl">{title}</h1>
                {description ? <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            </div>
            {action}
        </div>
    )
}
