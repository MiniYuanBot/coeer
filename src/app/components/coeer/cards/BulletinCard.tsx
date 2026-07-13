import { Link } from '@tanstack/react-router'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function BulletinCard({ bulletin }: { bulletin: any }) {
    return (
        <Link to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="block">
            <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletin.type}</Badge>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(bulletin.createdAt)}</span>
                </div>
                <h3 className="mt-3 font-semibold">{bulletin.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{bulletin.content}</p>
            </Card>
        </Link>
    )
}
