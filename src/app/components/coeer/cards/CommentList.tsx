import { formatDate } from '../lib/date'
import { Card } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'

export function CommentList({ comments = [] }: { comments?: any[] }) {
    if (!comments.length) return <EmptyState title="还没有回复" description="发起第一条有价值的讨论。" />
    return (
        <div className="grid gap-3">
            {comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">{comment.user?.name || '成员'}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{comment.content}</p>
                </Card>
            ))}
        </div>
    )
}
