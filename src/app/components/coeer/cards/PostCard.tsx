import { Link } from '@tanstack/react-router'
import { formatDate } from '../lib/date'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { PostContent } from './PostContent'
import { PostLikeButton } from './PostLikeButton'
import { PostBookmarkButton } from './PostBookmarkButton'

export function PostCard({ post, to }: { post: any; to?: string }) {
    const content = (
        <Card className="coeer-post">
            <div className="flex items-center gap-2">
                <Badge tone={post.isPinned ? 'primary' : 'default'}>{post.isPinned ? '置顶' : post.type === 'announcement' ? '公告' : post.type === 'discussion' ? '讨论' : post.type}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-[15px] font-medium">{to ? <Link to={to as any} className="coeer-focus rounded hover:text-primary">{post.title}</Link> : post.title}</h3>
            <PostContent key={post.id} content={post.content} className="mt-2 text-muted-foreground" />
            <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <PostLikeButton post={post} />
                <PostBookmarkButton post={post} />
            </div>
        </Card>
    )
    return content
}
