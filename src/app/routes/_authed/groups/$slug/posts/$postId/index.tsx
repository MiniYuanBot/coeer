import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { deleteGroupPostFn, togglePinPostFn } from '~/functions'
import { Badge, Button, Card, DetailLayout, Icon, Modal, SectionHeader, formatDateTime } from '@/components/coeer'

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
    <PageLayout className="coeer-detail-page">
      <SectionHeader level="h2"
        title={post.title}
        actionLayout="stack-on-mobile"
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin ? <Button variant="outline" onClick={handleTogglePin}>{post.isPinned ? '取消置顶' : '置顶'}</Button> : null}
            <Button asChild variant="outline"><Link to="/groups/$slug/posts/$postId/edit" params={{ slug, postId }}>编辑</Link></Button>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>删除</Button>
          </div>
        }
      />

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
              {post.updatedAt !== post.createdAt ? ' · 已编辑' : ''}
            </p>
          </div>
        </div>

        <div className="max-w-[76ch] whitespace-pre-wrap text-sm leading-7 text-foreground">
          {post.content}
        </div>
      </Card>
      </DetailLayout>

      <Modal open={showDeleteConfirm} title="删除帖子" onOpenChange={setShowDeleteConfirm}>
        <p className="text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">
          确定删除“{post.title}”吗？此操作不可撤销。
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>取消</Button>
          <Button variant="danger" onClick={handleDelete}>删除</Button>
        </div>
      </Modal>
    </PageLayout>
  )
}
