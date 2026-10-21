import * as React from 'react'
import { redeemItemStatusLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { MediaPreview } from '../ui/MediaPreview'

export function RedeemItemCard({ item, action }: { item: any; action?: React.ReactNode }) {
    return (
        <Card className="flex h-full flex-col overflow-hidden">
            <MediaPreview src={item.imageUrl} alt={item.name} />
            <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-medium">{item.name}</h3>
                    <Badge tone={item.status === 'active' ? 'success' : 'warning'}>{redeemItemStatusLabels[item.status] || item.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{item.description || '暂无说明'}</p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-medium tabular-nums text-[hsl(var(--primary))]"><Icon name="coins" /> {item.pointsCost}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">库存 {item.stock === -1 ? '不限' : item.stock}</span>
                </div>
                {action ? <div className="mt-auto pt-4">{action}</div> : null}
            </div>
        </Card>
    )
}
