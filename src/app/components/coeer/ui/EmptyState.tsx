import * as React from 'react'
import { Card } from './Card'
import { Icon } from './Icon'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <Card className="grid place-items-center rounded-xl p-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                <Icon name="spark" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-[15px] font-medium">{title}</h3>
            {description ? <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </Card>
    )
}
