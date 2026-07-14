import { Link } from '@tanstack/react-router'
import { groupCategoryLabels, groupStatusLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

export function GroupCard({ group }: { group: any }) {
    return (
        <Link to="/groups/$slug" params={{ slug: group.slug }} className="block">
            <Card className="h-full rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border))] hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[15px] font-medium">{group.name}</h3>
                            <Badge className="shrink-0 rounded-md">{groupCategoryLabels[group.category] || group.category}</Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{group.description || '暂无简介'}</p>
                    </div>
                    <Badge tone={group.status === 'approved' ? 'success' : 'warning'}>{groupStatusLabels[group.status] || group.status}</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{group.memberCount ?? 0} 名成员</span>
                    <span>{group.isPublic ? '公开' : '私密'}</span>
                </div>
            </Card>
        </Link>
    )
}
