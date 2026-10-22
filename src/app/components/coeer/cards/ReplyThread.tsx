import { useEffect, useState } from 'react'
import type { ReplyListItem, ReplyWithAuthor } from '@shared/contracts/replies'
import { listChildRepliesFn } from '~/functions/replies'
import { Button } from '../ui/Button'
import { Markdown } from '../ui/Markdown'
import { formatDateTime } from '../lib/date'

type ThreadActions = {
    userId: string
    canReply: boolean
    canManage: boolean
    pending: boolean
    revision: number
    openReplyId?: string
    onSelect: (reply: ReplyWithAuthor, edit?: boolean) => void
    onRemove: (id: string) => void
}

export function ReplyThread({ reply, parent, depth = 0, ...actions }: ThreadActions & {
    reply: ReplyListItem
    parent?: ReplyWithAuthor
    depth?: number
}) {
    const [expanded, setExpanded] = useState(false)
    const [limit, setLimit] = useState(20)
    const [children, setChildren] = useState<ReplyListItem[]>([])
    const [total, setTotal] = useState(reply.childCount)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)
    const childrenId = `reply-children-${reply.id}`

    useEffect(() => {
        if (actions.openReplyId === reply.id) setExpanded(true)
    }, [actions.openReplyId, actions.revision, reply.id])

    useEffect(() => {
        if (!expanded) return
        let active = true
        setLoading(true)
        setError('')
        void (async () => {
            try {
                const result = await listChildRepliesFn({ data: { parentId: reply.id, limit, offset: 0 } })
                if (!result.success || !result.data) throw new Error(result.state.message || '子回复加载失败')
                if (active) {
                    setChildren(result.data.items ?? [])
                    setTotal(result.data.total ?? 0)
                }
            } catch (error) {
                if (active) setError(error instanceof Error ? error.message : '子回复加载失败，请重试')
            } finally {
                if (active) setLoading(false)
            }
        })()
        return () => { active = false }
    }, [expanded, reply.id, limit, actions.revision, attempt])

    const name = reply.author?.name || '未知用户'
    const childCount = expanded ? total : reply.childCount
    return <li className="min-w-0">
        <article id={`reply-${reply.id}`} data-depth={depth} className="min-w-0 scroll-mt-20 py-4">
            {!reply.content ? <p className="text-xs text-muted-foreground">该回复已删除</p> : <>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="break-all font-medium text-foreground">{name}</span>
                    <time dateTime={new Date(reply.createdAt).toISOString()}>{formatDateTime(reply.createdAt)}</time>
                </div>
                {parent ? <p className="mb-2 text-xs text-muted-foreground">
                    第 {depth + 1} 级 · <a className="coeer-focus rounded hover:text-primary" href={`#reply-${parent.id}`}>
                        回复 {parent.content ? parent.author?.name || '未知用户' : '已删除的回复'}
                    </a>
                </p> : null}
                <Markdown content={reply.content} />
                <div className="mt-2 flex flex-wrap gap-2">
                    {actions.canReply ? <Button size="sm" variant="ghost" disabled={actions.pending} onClick={() => actions.onSelect(reply)}>回复</Button> : null}
                    {actions.canReply && reply.userId === actions.userId ? <Button size="sm" variant="ghost" disabled={actions.pending} onClick={() => actions.onSelect(reply, true)}>编辑</Button> : null}
                    {actions.canManage || reply.userId === actions.userId ? <Button size="sm" variant="ghost" disabled={actions.pending} onClick={() => actions.onRemove(reply.id)}>删除</Button> : null}
                </div>
            </>}
            {childCount > 0 || expanded ? <Button size="sm" variant="ghost" className="mt-2" aria-expanded={expanded} aria-controls={childrenId}
                onClick={() => setExpanded(!expanded)}>
                {expanded ? '收起子回复' : `展开 ${childCount} 条子回复`}
            </Button> : null}
        </article>
        <div id={childrenId} hidden={!expanded} className="coeer-reply-children" data-deep={depth >= 3 || undefined}>
            <ol aria-label={`${reply.content ? name : '已删除回复'}的子回复`} className="divide-y divide-border">
                {children.map((child) => <ReplyThread key={child.id} {...actions} reply={child} parent={reply} depth={depth + 1} />)}
            </ol>
            {loading ? <p role="status" className="py-3 text-xs text-muted-foreground">正在加载子回复…</p> : null}
            {error ? <div className="py-3"><p role="alert" className="text-sm text-danger">{error}</p>
                <Button size="sm" variant="ghost" onClick={() => setAttempt(attempt + 1)}>重试加载</Button>
            </div> : null}
            {!loading && !error && children.length < total ? <Button size="sm" variant="ghost" className="my-2" onClick={() => setLimit(limit + 20)}>加载更多子回复</Button> : null}
        </div>
    </li>
}
