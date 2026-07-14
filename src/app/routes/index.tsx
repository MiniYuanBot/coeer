import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FeedbackCard,
  Icon,
  PointsSummaryCard,
  PostCard,
  SectionHeader,
  activityStatusLabels,
  formatDate,
  groupCategoryLabels,
} from '@/components/coeer'
import { getBulletinFeedFn, getFeedbacksFn, getMyPointBalanceFn, listActivitiesFn, listAllGroupsFn, listPostsByGroupFn } from '~/functions'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const [groupsResult, bulletinsResult, activitiesResult, feedbacksResult, pointsResult] = await Promise.allSettled([
      listAllGroupsFn({ data: { limit: 6, offset: 0 } }),
      getBulletinFeedFn({ data: { limit: 5, offset: 0 } }),
      listActivitiesFn({ data: { limit: 4, offset: 0 } }),
      getFeedbacksFn({ data: { limit: 4, offset: 0 } }),
      context.user ? getMyPointBalanceFn() : Promise.resolve(null),
    ])

    const groups = groupsResult.status === 'fulfilled' ? groupsResult.value?.items ?? [] : []
    const officialGroup = groups.find((group: any) => group.slug === 'coeer-official') ?? groups[0]
    const postsResult = officialGroup
      ? await Promise.allSettled([listPostsByGroupFn({ data: { groupId: officialGroup.id, limit: 5, offset: 0 } })])
      : []

    return {
      groups,
      posts: postsResult[0]?.status === 'fulfilled' ? postsResult[0].value?.items ?? [] : [],
      bulletins: bulletinsResult.status === 'fulfilled' ? bulletinsResult.value?.data?.items ?? [] : [],
      activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value?.data?.items ?? [] : [],
      feedbacks: feedbacksResult.status === 'fulfilled' ? feedbacksResult.value?.items ?? [] : [],
      balance: pointsResult.status === 'fulfilled' ? pointsResult.value?.data?.balance ?? 0 : 0,
      user: context.user,
    }
  },
  component: Home,
})

function Home() {
  const { groups, posts, bulletins, activities, feedbacks, balance, user } = Route.useLoaderData()

  return (
    <div className="space-y-6">
      <SectionHeader
        title="动态"
        description="关注学院社区里的活动、公告、帖子和反馈进展。"
        action={
          user ? (
            <Link to="/feedbacks/create">
              <Button><Icon name="send" /> 提交反馈</Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button><Icon name="login" /> 登录</Button>
            </Link>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_21rem] xl:grid-cols-[16rem_1fr_21rem]">
        <aside className="hidden space-y-4 xl:block">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">我的群组</h2>
              <Link to="/groups" className="text-xs text-[hsl(var(--primary))]">全部</Link>
            </div>
            <div className="grid gap-2">
              {groups.slice(0, 4).map((group: any) => (
                <Link key={group.id} to="/groups/$slug" params={{ slug: group.slug }} className="rounded-lg px-2 py-2 text-sm hover:bg-[hsl(var(--muted))]">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{group.name}</span>
                    <Badge className="shrink-0 rounded-md">{groupCategoryLabels[group.category] || group.category}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h2 className="text-[15px] font-medium">成就进度</h2>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full w-2/3 rounded-full bg-[hsl(var(--primary))]" />
            </div>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">已解锁 2 / 3 个基础成就</p>
          </Card>
        </aside>

        <section className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[10px] bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                <Icon name="spark" />
              </div>
              <div>
                <div className="text-[15px] font-medium">今天想一起推进什么？</div>
                <p className="text-[13px] text-[hsl(var(--muted-foreground))]">发帖、反馈、报名活动，都会沉淀成你的成长记录。</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link to="/groups"><Button variant="outline" size="sm"><Icon name="group" /> 找群组</Button></Link>
              <Link to="/activities"><Button variant="outline" size="sm"><Icon name="calendar" /> 看活动</Button></Link>
              <Link to="/redeems"><Button variant="outline" size="sm"><Icon name="gift" /> 逛商城</Button></Link>
            </div>
          </Card>

          {posts.length ? posts.map((post: any) => <PostCard key={post.id} post={post} />) : (
            <EmptyState title="动态还在等待第一条内容" description="运行种子数据或加入群组后，这里会显示帖子流。" />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {feedbacks.slice(0, 2).map((feedback: any) => <FeedbackCard key={feedback.id} feedback={feedback} />)}
          </div>
        </section>

        <aside className="space-y-4">
          <PointsSummaryCard balance={balance} />
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">近期活动</h2>
              <Link to="/activities" className="text-xs text-[hsl(var(--primary))]">更多</Link>
            </div>
            <div className="grid gap-3">
              {activities.slice(0, 2).map((activity: any) => (
                <div key={activity.id} className="rounded-lg border border-[hsl(var(--border)/0.6)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={activity.status === 'ongoing' ? 'success' : activity.status === 'completed' || activity.status === 'cancelled' ? 'default' : 'primary'}>
                      {activityStatusLabels[activity.status] || activity.status}
                    </Badge>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(activity.startTime)}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-sm font-medium">{activity.title}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-medium">公告</h2>
              <Link to="/bulletins" className="text-xs text-[hsl(var(--primary))]">更多</Link>
            </div>
            <div className="grid gap-3">
              {bulletins.slice(0, 2).map((bulletin: any) => (
                <Link key={bulletin.id} to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="rounded-lg border border-[hsl(var(--border)/0.6)] p-3 hover:bg-[hsl(var(--muted))]">
                  <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletin.title}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
