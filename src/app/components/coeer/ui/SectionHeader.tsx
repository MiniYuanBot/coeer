import * as React from 'react'

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-4">
            <div className="min-w-0 flex-1 basis-48">
                <h1 className="text-[23px] font-semibold leading-tight tracking-[-0.025em] text-foreground">{title}</h1>
                {description ? <p className="mt-2 max-w-[70ch] text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
            </div>
            {action}
        </div>
    )
}
