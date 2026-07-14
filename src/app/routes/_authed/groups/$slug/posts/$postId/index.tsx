import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { deleteGroupPostFn, togglePinPostFn } from '~/functions'
import { Badge, Button, Card, Icon, Modal, SectionHeader, formatDateTime } from '@/components/coeer'

export const Route = createFileRoute('/_authed/groups/$slug/posts/$postId/')({
  component: PostIndexComponent,
})

function PostIndexComponent() {
  const { group, post, isAdmin } = Route.useRouteContext()
  const { slug, postId } = Route.useParams()
  const navigate = useNavigate()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = async () => {
    await deleteGroupPostFn({ data: { id: postId } })
    navigate({ to: '/groups/$slug/posts', params: { slug } })
  }

  const handleTogglePin = async () => {
    await togglePinPostFn({ data: { id: postId, isPinned: !post.isPinned } })
    navigate({ to: '/groups/$slug/posts/$postId', params: { slug, postId } })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionHeader
        title={post.title}
        description={`${group.name} · ${formatDateTime(post.createdAt)}`}
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? <Button variant="outline" onClick={handleTogglePin}>{post.isPinned ? '取消置顶' : '置顶'}</Button> : null}
            <Link to="/groups/$slug/posts/$postId/edit" params={{ slug, postId }}>
              <Button variant="outline">编辑</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>删除</Button>
          </div>
        }
      />

      <Card className="rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          {post.isPinned ? <Badge tone="primary">置顶</Badge> : null}
          <Badge>{post.type === 'announcement' ? '公告' : '讨论'}</Badge>
        </div>

        <div className="my-5 flex items-center gap-3 border-b border-[hsl(var(--border))] pb-5">
          <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-sm font-medium text-[hsl(var(--primary))]">
            {(post.author?.name || '未知用户').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[15px] font-medium">{post.author?.name || '未知用户'}</p>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))]">
              {formatDateTime(post.createdAt)}
              {post.updatedAt !== post.createdAt ? ' · 已编辑' : ''}
            </p>
          </div>
        </div>

        <div className="whitespace-pre-wrap text-sm leading-7 text-[hsl(var(--foreground))]">
          {post.content}
        </div>
      </Card>

      <Link to="/groups/$slug/posts" params={{ slug }} className="inline-flex items-center gap-2 text-sm text-[hsl(var(--primary))]">
        <Icon name="chevron" className="h-4 w-4 rotate-180" /> 返回帖子
      </Link>

      <Modal open={showDeleteConfirm} title="删除帖子" onOpenChange={setShowDeleteConfirm}>
        <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          确定删除“{post.title}”吗？此操作不可撤销。
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
          <Button variant="danger" onClick={handleDelete}>删除</Button>
        </div>
      </Modal>
    </div>
  )
}
