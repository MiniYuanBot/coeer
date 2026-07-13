import { Link } from '@tanstack/react-router'
import * as React from 'react'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function PostCard({ post, to }: { post: any; to?: string }) {
    const content = (
        <Card className="p-5">
            <div className="flex items-center gap-2">
                <Badge tone={post.isPinned ? 'primary' : 'default'}>{post.isPinned ? '置顶' : post.type}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{post.content}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-1"><Icon name="heart" /> 点赞</span>
                <span className="inline-flex items-center gap-1"><Icon name="comment" /> 回复</span>
            </div>
        </Card>
    )
    if (!to) return content
    return <Link to={to as any} className="block">{content}</Link>
}
