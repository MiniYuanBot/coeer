import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { Markdown } from '@/components/coeer/ui/Markdown'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'
import { PostLikeButton } from '@/components/coeer/cards/PostLikeButton'
import { PostBookmarkButton } from '@/components/coeer/cards/PostBookmarkButton'
import { GroupReplies } from '@/components/coeer/cards/GroupReplies'
import { listRepliesByTargetFn } from '~/functions/replies'
import { deleteGroupPostFn, togglePinPostFn } from '~/functions'
import { Badge, Button, Card, DetailLayout, Icon, Modal, SectionHeader, formatDateTime } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/posts/$postId/')({
  validateSearch: z.object({ replyPage: z.coerce.number().int().min(1).catch(1).default(1) }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (!context.isAdmin && !context.isMember && context.user?.role !== 'admin') return null
    const result = await listRepliesByTargetFn({ data: { targetType: 'group_post', targetId: context.post.id, rootsOnly: true, limit: 20, offset: (deps.replyPage - 1) * 20 } })
    if (!result.success) throw new Error(result.state.message || '回复加载失败')
    return result.data ?? null
  },
  component: PostIndexComponent,
})

function PostIndexComponent() {
  const { group, post, isAdmin, isMember, user } = Route.useRouteContext()
  const replies = Route.useLoaderData()
  const { replyPage } = Route.useSearch()
  const router = useRouter()
  const canModify = isAdmin || post.authorId === user?.id
  const { slug, postId } = Route.useParams()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState('')

  const handleDelete = async () => {
    setActionPending(true); setActionError('')
    try {
      await deleteGroupPostFn({ data: { id: postId } })
      await navigate({ to: '/groups/$slug/posts', params: { slug } })
    } catch (error) { setActionError(error instanceof Error ? error.message : '删除失败') }
    finally { setActionPending(false) }
  }

  const handleTogglePin = async () => {
    setActionPending(true); setActionError('')
    try {
      await togglePinPostFn({ data: { id: postId, isPinned: !post.isPinned } })
      await router.invalidate()
    } catch (error) { setActionError(error instanceof Error ? error.message : '置顶失败') }
    finally { setActionPending(false) }
  }

  return (
    <PageLayout>
      <SectionHeader level="h2"
        title={post.title}
        actionLayout="stack-on-mobile"
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? <Button variant="outline" loading={actionPending} onClick={handleTogglePin}>{post.isPinned ? '取消置顶' : '置顶'}</Button> : null}
            {canModify ? <><Button asChild variant="outline"><Link to="/groups/$slug/posts/$postId/edit" params={{ slug, postId }}>编辑</Link></Button>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>删除</Button></> : null}
          </div>
        }
      />
      {actionError ? <p role="alert" className="text-sm text-danger">{actionError}</p> : null}

      <DetailLayout asideLabel="帖子信息" aside={
        <section className="space-y-5 rounded-lg border border-border bg-muted/20 p-5">
          <h2 className="text-xs font-semibold">帖子信息</h2>
          <div className="flex flex-wrap gap-2">
            {post.isPinned ? <Badge tone="primary">置顶</Badge> : null}
            <Badge>{post.type === 'announcement' ? '公告' : '讨论'}</Badge>
          </div>
          <dl className="space-y-4 text-xs">
            <div><dt className="text-muted-foreground">所属群组</dt><dd className="mt-1.5 leading-5">{group.name}</dd></div>
            <div><dt className="text-muted-foreground">发布时间</dt><dd className="mt-1.5 tabular-nums">{formatDateTime(post.createdAt)}</dd></div>
          </dl>
          <Link to="/groups/$slug/posts" params={{ slug }} className="coeer-focus inline-flex min-h-9 items-center gap-1.5 rounded text-xs text-muted-foreground hover:text-foreground">
            <Icon name="chevron" className="h-3.5 w-3.5 rotate-180" />返回帖子列表
          </Link>
        </section>
      }>
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3 border-b border-border pb-5">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
            {(post.author?.name || '未知用户').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[15px] font-medium">{post.author?.name || '未知用户'}</p>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
              发布者
              {new Date(post.updatedAt).getTime() !== new Date(post.createdAt).getTime() ? ' · 已编辑' : ''}
            </p>
          </div>
        </div>

        <Markdown content={post.content} className="max-w-[76ch] text-foreground" />
        <div className="mt-6 flex gap-4 border-t border-border pt-4"><PostLikeButton post={post} /><PostBookmarkButton post={post} /></div>
      </Card>
      {replies ? <>
        <GroupReplies key={post.id} postId={post.id} replies={replies.items ?? []} total={replies.replyTotal ?? 0} userId={user!.id}
          onRootCreated={replyPage > 1 ? () => navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId }, search: { replyPage: 1 } }) : undefined}
          canReply={(isAdmin || isMember) && group.status === 'approved'} canManage={isAdmin || user?.role === 'admin'} />
        {(replies.total ?? 0) > 20 || replyPage > 1 ? <div className="mt-4 flex justify-end gap-3">
          <Button size="sm" variant="outline" disabled={replyPage <= 1} onClick={() => void navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId }, search: { replyPage: replyPage - 1 } })}>上一页</Button>
          <Button size="sm" variant="outline" disabled={replyPage * 20 >= (replies.total ?? 0)} onClick={() => void navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId }, search: { replyPage: replyPage + 1 } })}>下一页</Button>
        </div> : null}
      </> : <p className="mt-6 text-sm text-muted-foreground">加入群组后可查看和参与群内回复。</p>}
      </DetailLayout>

      <Modal open={showDeleteConfirm} title="删除帖子" onOpenChange={setShowDeleteConfirm}>
        <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          确定删除“{post.title}”吗？此操作不可撤销。
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
          <Button variant="danger" loading={actionPending} onClick={handleDelete}>删除</Button>
        </div>
      </Modal>
    </PageLayout>
  )
}
