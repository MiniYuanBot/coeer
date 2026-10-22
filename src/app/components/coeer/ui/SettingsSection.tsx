import type { ReactNode } from 'react'

export function SettingsSection({ id, title, description, children }: {
    id: string
    title: string
    description: string
    children: ReactNode
}) {
    return (
        <section className="coeer-settings-section" aria-labelledby={id}>
            <div className="max-w-[32ch]">
                <h2 id={id} className="scroll-mt-20 text-sm font-semibold">{title}</h2>
                <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{description}</p>
            </div>
            <div className="min-w-0">{children}</div>
        </section>
    )
}
