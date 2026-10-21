import type { IconName } from '../lib/types'
import { Icon } from './Icon'

export function StatsBar({ items, label }: {
    label: string
    items: Array<{ label: string; value: number; icon: IconName }>
}) {
    return <dl aria-label={label} data-count={items.length} className="coeer-stats">
        {items.map(item => <div key={item.label} className="min-w-0 bg-card px-4 py-4">
            <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon name={item.icon} className="hidden h-3.5 w-3.5 sm:block" />{item.label}</dt>
            <dd className="mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums">{item.value.toLocaleString('zh-CN')}</dd>
        </div>)}
    </dl>
}
