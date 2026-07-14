import { Link } from '@tanstack/react-router'
import { formatDate } from '../lib/date'
import { bulletinTypeLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function BulletinCard({ bulletin }: { bulletin: any }) {
    return (
        <Link to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="group block">
            <Card className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border))] hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletinTypeLabels[bulletin.type] || bulletin.type}</Badge>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(bulletin.createdAt)}</span>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-medium">{bulletin.title}</h3>
                    <Icon name="chevron" className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{bulletin.content}</p>
            </Card>
        </Link>
    )
}
