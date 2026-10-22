import { useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { ReplyWithAuthor } from '@shared/contracts/replies'
import { createReplyFn, deleteReplyFn, updateReplyFn } from '~/functions/replies'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Markdown, MarkdownHelp } from '../ui/Markdown'
import { formatDateTime } from '../lib/date'

export function GroupReplies({ postId, replies, total, userId, canReply, canManage }: {
    postId: string; replies: ReplyWithAuthor[]; total: number; userId: string; canReply: boolean; canManage: boolean
}) {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [replyTo, setReplyTo] = useState<ReplyWithAuthor>()
    const [editing, setEditing] = useState<string>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    async function submit(event: FormEvent) {
        event.preventDefault()
        if (pending || !content.trim()) return
        setPending(true)
        setError('')
        try {
            const result = editing
                ? await updateReplyFn({ data: { id: editing, content } })
                : await createReplyFn({ data: { targetType: 'group_post', targetId: postId, parentId: replyTo?.id, content } })
            if (!result.success) throw new Error(result.state.message || '回复失败')
            setContent(''); setEditing(undefined); setReplyTo(undefined)
            await router.invalidate()
        } catch (error) { setError(error instanceof Error ? error.message : '回复失败，请重试') }
        finally { setPending(false) }
    }
    async function remove(id: string) {
        if (pending) return
        setPending(true)
        setError('')
        try {
            const result = await deleteReplyFn({ data: { id } })
            if (!result.success) throw new Error(result.state.message || '删除失败')
            if (editing === id || replyTo?.id === id) { setEditing(undefined); setReplyTo(undefined); setContent('') }
            await router.invalidate()
        } catch (error) { setError(error instanceof Error ? error.message : '删除失败，请重试') }
        finally { setPending(false) }
    }
    function selectReply(reply: ReplyWithAuthor, edit = false) {
        setEditing(edit ? reply.id : undefined)
        setReplyTo(edit ? undefined : reply)
        setContent(edit ? reply.content : '')
        setError('')
        document.getElementById('group-reply-content')?.focus()
    }
    return <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">群内回复 <span className="text-muted-foreground">{total}</span></h2>
        <div className="mt-4 divide-y divide-border">
            {replies.map((reply) => <article key={reply.id} className="py-4">
                {!reply.content ? <p className="text-xs text-muted-foreground">该回复已删除</p> : <>
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{reply.author?.name || '未知用户'}</span>
                        <time dateTime={new Date(reply.createdAt).toISOString()}>{formatDateTime(reply.createdAt)}</time>
                        {reply.parentId ? <span>· 回复上文</span> : null}
                    </div>
                    <Markdown content={reply.content} />
                    <div className="mt-2 flex flex-wrap gap-2">
                        {canReply ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => selectReply(reply)}>回复</Button> : null}
                        {canReply && reply.userId === userId ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => selectReply(reply, true)}>编辑</Button> : null}
                        {canManage || reply.userId === userId ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => void remove(reply.id)}>删除</Button> : null}
                    </div>
                </>}
            </article>)}
            {!replies.length ? <p className="py-4 text-sm text-muted-foreground">还没有回复。</p> : null}
        </div>
        {error ? <p role="alert" className="my-3 text-sm text-danger">{error}</p> : null}
        {canReply ? <form onSubmit={(event) => void submit(event)} className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="group-reply-content" className="text-sm font-medium">{editing ? '编辑回复' : replyTo ? `回复 ${replyTo.author?.name || '成员'}` : '发表回复'}</label>
                {editing || replyTo ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setEditing(undefined); setReplyTo(undefined); setContent('') }}>取消</Button> : null}
            </div>
            <textarea id="group-reply-content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={2000} rows={4}
                disabled={pending} placeholder="分享思路，也可以用 $…$ 或 $$…$$ 写公式"
                className="coeer-focus w-full resize-y rounded-md border border-border bg-card p-3 text-sm leading-6" />
            <MarkdownHelp />
            <div className="mt-3 flex justify-end"><Button type="submit" loading={pending} disabled={!content.trim()}>{editing ? '保存修改' : '发送回复'}</Button></div>
        </form> : <p className="mt-4 text-xs text-muted-foreground">仅已加入且通过审核的成员可以在群内回复。</p>}
    </Card>
}
