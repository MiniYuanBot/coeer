import { useRef, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { ReplyListItem, ReplyWithAuthor } from '@shared/contracts/replies'
import { createReplyFn, deleteReplyFn, updateReplyFn } from '~/functions/replies'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { MarkdownEditor } from '../ui/MarkdownEditor'
import { ReplyThread } from './ReplyThread'

export function GroupReplies({ postId, replies, total, userId, canReply, canManage, onRootCreated }: {
    postId: string; replies: ReplyListItem[]; total: number; userId: string; canReply: boolean; canManage: boolean
    onRootCreated?: () => Promise<unknown>
}) {
    const router = useRouter()
    const [content, setContent] = useState('')
    const [replyTo, setReplyTo] = useState<ReplyWithAuthor>()
    const [editing, setEditing] = useState<string>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    const [openReplyId, setOpenReplyId] = useState<string>()
    const input = useRef<HTMLTextAreaElement>(null)

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
            setOpenReplyId(editing ? undefined : replyTo?.id)
            setContent(''); setEditing(undefined); setReplyTo(undefined)
            setRevision((value) => value + 1)
            if (!editing && !replyTo) await onRootCreated?.()
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
            setOpenReplyId(undefined)
            if (editing === id || replyTo?.id === id) { setEditing(undefined); setReplyTo(undefined); setContent('') }
            setRevision((value) => value + 1)
            await router.invalidate()
        } catch (error) { setError(error instanceof Error ? error.message : '删除失败，请重试') }
        finally { setPending(false) }
    }
    function selectReply(reply: ReplyWithAuthor, edit = false) {
        setEditing(edit ? reply.id : undefined)
        setReplyTo(edit ? undefined : reply)
        setContent(edit ? reply.content : '')
        setError('')
        input.current?.focus()
    }
    return <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">群内回复 <span className="text-muted-foreground">{total}</span></h2>
        <ol aria-label="群内回复" className="mt-4 divide-y divide-border">
            {replies.map((reply) => <ReplyThread key={reply.id} reply={reply} userId={userId} canReply={canReply} canManage={canManage}
                pending={pending} revision={revision} openReplyId={openReplyId} onSelect={selectReply} onRemove={(id) => void remove(id)} />)}
        </ol>
        {!replies.length ? <p className="py-4 text-sm text-muted-foreground">还没有回复。</p> : null}
        {error ? <p role="alert" className="my-3 text-sm text-danger">{error}</p> : null}
        {canReply ? <form onSubmit={(event) => void submit(event)} className="mt-4 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="group-reply-content" className="text-sm font-medium">{editing ? '编辑回复' : replyTo ? `回复 ${replyTo.author?.name || '成员'}` : '发表回复'}</label>
                {editing || replyTo ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setEditing(undefined); setReplyTo(undefined); setContent('') }}>取消</Button> : null}
            </div>
            <MarkdownEditor ref={input} id="group-reply-content" previewLabel="回复实时预览" value={content} onChange={(event) => setContent(event.target.value)}
                required maxLength={2000} rows={6} disabled={pending} placeholder="分享思路，也可以用 $…$ 或 $$…$$ 写公式" />
            <div className="mt-3 flex justify-end"><Button type="submit" loading={pending} disabled={!content.trim()}>{editing ? '保存修改' : '发送回复'}</Button></div>
        </form> : <p className="mt-4 text-xs text-muted-foreground">仅已加入且通过审核的成员可以在群内回复。</p>}
    </Card>
}
