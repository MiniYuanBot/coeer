import * as React from 'react'
import { Card } from './Card'
import { Icon } from './Icon'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <Card className="grid place-items-center p-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                <Icon name="spark" />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            {description ? <p className="mt-2 max-w-md text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </Card>
    )
}
