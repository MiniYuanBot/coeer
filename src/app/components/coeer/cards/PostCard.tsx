import { Link } from '@tanstack/react-router'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { PostContent } from './PostContent'
import { PostLikeButton } from './PostLikeButton'
import { PostBookmarkButton } from './PostBookmarkButton'
import type { ReactNode } from 'react'

export function PostCard({ post, to, variant = 'default', source }: { post: any; to?: string; variant?: 'default' | 'home'; source?: ReactNode }) {
    const home = variant === 'home'
    const pinned = !home && post.isPinned
    const Container = home ? 'article' : Card
    const content = (
        <Container className={home ? 'coeer-home-item' : 'coeer-post'}>
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={pinned ? 'primary' : 'default'}>{pinned ? '置顶' : post.type === 'announcement' ? '公告' : post.type === 'discussion' ? '讨论' : post.type}</Badge>
                {source ? <span className="text-xs text-muted-foreground">{source}</span> : null}
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-[15px] font-medium">{to ? <Link to={to as any} className="coeer-focus rounded hover:text-primary">{post.title}</Link> : post.title}</h3>
            <PostContent key={post.id} content={post.content} collapsedHeight={home ? 140 : 168} className="mt-2 text-muted-foreground" />
            <div className={home ? 'mt-3 flex items-center gap-3 text-xs text-muted-foreground' : 'mt-4 flex items-center gap-4 text-sm text-muted-foreground'}>
                <PostLikeButton post={post} compact={home} />
                <PostBookmarkButton post={post} compact={home} />
            </div>
        </Container>
    )
    return content
}
