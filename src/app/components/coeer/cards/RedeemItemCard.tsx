import * as React from 'react'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function RedeemItemCard({ item, action }: { item: any; action?: React.ReactNode }) {
    return (
        <Card className="overflow-hidden">
            <div className="grid aspect-[4/2.3] place-items-center bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <Icon name="gift" className="h-10 w-10" />}
            </div>
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge tone={item.status === 'active' ? 'success' : 'warning'}>{item.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{item.description || '暂无说明'}</p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--primary))]"><Icon name="coins" /> {item.pointsCost}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">库存 {item.stock === -1 ? '不限' : item.stock}</span>
                </div>
                {action ? <div className="mt-4">{action}</div> : null}
            </div>
        </Card>
    )
}
