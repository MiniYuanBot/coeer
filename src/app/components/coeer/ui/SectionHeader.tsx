import * as React from 'react'

export function SectionHeader({ title, description, action, level = 'h1', actionLayout = 'inline' }: { title: string; description?: string; action?: React.ReactNode; level?: 'h1' | 'h2'; actionLayout?: 'inline' | 'stack-on-mobile' }) {
    const Heading = level
    return (
        <div className="coeer-page-header" data-action-layout={actionLayout}>
            <Heading className={'break-words font-semibold leading-snug tracking-[-0.025em] text-foreground ' + (level === 'h1' ? 'text-[22px]' : 'text-lg')}>{title}</Heading>
            {description ? <p className="coeer-page-description max-w-[70ch] text-[13px] leading-6 text-muted-foreground">{description}</p> : null}
            {action ? <div className="coeer-page-actions flex max-w-full flex-wrap items-center gap-2">{action}</div> : null}
        </div>
    )
}
