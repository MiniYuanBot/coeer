import { Link } from '@tanstack/react-router'
import { groupCategoryLabels, groupStatusLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function GroupCard({ group }: { group: any }) {
    return (
        <Link to="/groups/$slug" params={{ slug: group.slug }} className="block">
            <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate font-semibold">{group.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{group.description || '暂无简介'}</p>
                    </div>
                    <Badge tone={group.status === 'approved' ? 'success' : 'warning'}>{groupStatusLabels[group.status] || group.status}</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{groupCategoryLabels[group.category] || group.category}</span>
                    <span>{group.isPublic ? '公开' : '私密'}</span>
                </div>
            </Card>
        </Link>
    )
}
