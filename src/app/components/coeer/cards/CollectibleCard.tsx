import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { MediaPreview } from '../ui/MediaPreview'
import { cardRarityLabels } from '../lib/labels'
import type { CardRarity } from '@shared/constants/cards'

export function CollectibleCard({ card, count }: {
    card: { name: string; imageUrl: string; rarity: CardRarity; description?: string | null; series?: string | null }
    count?: number
}) {
    return <Card className="h-full overflow-hidden">
        <MediaPreview src={card.imageUrl} alt={card.name} icon="card" preset="card" />
        <div className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={card.rarity === 'legendary' ? 'warning' : card.rarity === 'rare' ? 'primary' : 'muted'}>{cardRarityLabels[card.rarity]}</Badge>
                {count !== undefined ? <span className="text-xs tabular-nums text-muted-foreground">拥有 {count} 张</span> : null}
            </div>
            <h3 className="text-[15px] font-medium">{card.name}</h3>
            {card.series ? <p className="text-xs text-muted-foreground">{card.series}</p> : null}
            {card.description ? <p className="line-clamp-2 text-[13px] leading-6 text-muted-foreground">{card.description}</p> : null}
        </div>
    </Card>
}
