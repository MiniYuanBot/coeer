import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PostCard({ post, to }: { post: any; to?: string }) {
    const content = (
        <Card className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[hsl(var(--border))] hover:shadow-sm">
            <div className="flex items-center gap-2">
                <Badge tone={post.isPinned ? 'primary' : 'default'}>{post.isPinned ? '置顶' : post.type}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-[15px] font-medium">{post.title}</h3>
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{post.content}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-1"><Icon name="heart" /> 点赞</span>
                <span className="inline-flex items-center gap-1"><Icon name="comment" /> 回复</span>
            </div>
        </Card>
    )
    if (!to) return content
    return <Link to={to as any} className="block">{content}</Link>
}
