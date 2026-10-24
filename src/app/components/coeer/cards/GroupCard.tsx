import { Link } from '@tanstack/react-router'
import { groupCategoryLabels, groupStatusLabels } from '../lib/labels'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import type { GroupWithStats } from '@shared/contracts'

export function GroupCard({ group }: { group: GroupWithStats }) {
    return (
        <Link to="/groups/$slug" params={{ slug: group.slug }} className="coeer-focus block rounded-lg">
            <Card className="h-full p-5 transition-colors hover:bg-muted">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="break-words text-[15px] font-medium leading-6">{group.name}</h3>
                        <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{group.description || '暂无简介'}</p>
                    </div>
                    <Badge tone={group.status === 'approved' ? 'success' : 'warning'}>{groupStatusLabels[group.status] || group.status}</Badge>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge>{groupCategoryLabels[group.category] || group.category}</Badge>
                    <span className="ml-auto">{group.memberCount} 名成员</span>
                    <span aria-hidden="true">·</span><span>{group.isPublic ? '公开' : '私密'}</span>
                </div>
            </Card>
        </Link>
    )
}
