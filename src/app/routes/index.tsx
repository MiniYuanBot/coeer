import { PageLayout } from '@/components/coeer/ui/PageLayout'
import { BrandMark } from '@/components/coeer/layout/BrandMark'
import { useActivityClock } from '@/hooks/useActivityClock'
import { activityStatusAt } from '@shared/activities'
import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { PostContent } from '@/components/coeer/cards/PostContent'
import { Minigong } from '@/components/coeer/ui/Minigong'
import {
  AppShell,
  Badge,
  Button,
  EmptyState,
  FeedbackCard,
  Icon,
  PointsSummaryCard,
  PostCard,
  SectionHeader,
  ThemeToggle,
  activityStatusLabels,
  formatDate,
  groupCategoryLabels,
} from '@/components/coeer'
import { getBulletinFeedFn, getFeedbacksFn, getMyPointBalanceFn, getRecentPublicPostsFn, listActivitiesFn, listMyGroupsFn } from '~/functions'

const HOME_LIMIT = 5

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const user = context.user

    const [postsResult, bulletinsResult, activitiesResult, feedbacksResult, myGroupsResult, pointsResult] =
      await Promise.allSettled([
        getRecentPublicPostsFn(),
        getBulletinFeedFn({ data: { type: 'official', limit: HOME_LIMIT, offset: 0 } }),
        listActivitiesFn({ data: { limit: HOME_LIMIT, offset: 0, sort: 'latest', publicOnly: true } }),
        user ? getFeedbacksFn({ data: { view: 'public', limit: HOME_LIMIT, offset: 0 } }) : Promise.resolve(null),
        // 登录用户：真实“我的群组”列表；游客不请求（该接口要求登录）
        user ? listMyGroupsFn({ data: { limit: 8, offset: 0 } }) : Promise.resolve(null),
        user ? getMyPointBalanceFn() : Promise.resolve(null),
      ])

    const myGroups =
      myGroupsResult.status === 'fulfilled' && myGroupsResult.value?.items
        ? myGroupsResult.value.items.map((member: any) => member.group).filter(Boolean)
        : []
    return {
      myGroups,
      posts: postsResult.status === 'fulfilled' ? postsResult.value ?? [] : [],
      bulletins: bulletinsResult.status === 'fulfilled' ? bulletinsResult.value?.data?.items ?? [] : [],
      activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value?.data?.items ?? [] : [],
      feedbacks: feedbacksResult.status === 'fulfilled' ? feedbacksResult.value?.items ?? [] : [],
      balance: pointsResult.status === 'fulfilled' ? pointsResult.value?.data?.balance ?? null : null,
      feedErrors: {
        bulletins: bulletinsResult.status === 'rejected' || bulletinsResult.value?.success === false,
        updates: postsResult.status === 'rejected' || activitiesResult.status === 'rejected' || activitiesResult.value?.success === false,
        feedbacks: feedbacksResult.status === 'rejected',
        groups: myGroupsResult.status === 'rejected',
      },
      user,
    }
  },
  component: Home,
})

type HomeData = {
  myGroups: any[]
  posts: any[]
  bulletins: any[]
  activities: any[]
  feedbacks: any[]
  balance: number | null
  feedErrors?: { bulletins: boolean; updates: boolean; feedbacks: boolean; groups: boolean }
  user: { id: string; role: string; name?: string | null; email: string } | null | undefined
}

function Home() {
  const loaded = Route.useLoaderData()
  const now = useActivityClock()
  const data = { ...loaded, activities: loaded.activities.map((activity) => ({ ...activity, status: activityStatusAt(activity, now) })) }

  // 登录用户进入 App 外壳（侧边栏 + 移动端抽屉）
  if (data.user) {
    return (
      <AppShell user={data.user}>
        <HomeContent data={data} />
      </AppShell>
    )
  }

  // 游客：品牌欢迎区与真实公开动态预览。
  return <GuestLanding data={data} />
}

function HomeContent({ data }: { data: HomeData }) {
  const { myGroups, activities, balance, user } = data
  return (
    <PageLayout header={<div className="coeer-home-welcome">
      <div>
      <SectionHeader title="动态" description="欢迎回来。看看社区的新消息，跟进你的反馈。" />
      <div className="coeer-home-shortcuts text-muted-foreground">
        <Link to="/groups" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="group" className="h-3.5 w-3.5" />发现群组</Link>
        <Link to="/activities" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="calendar" className="h-3.5 w-3.5" />参与活动</Link>
        <Link to="/feedbacks/create" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="feedback" className="h-3.5 w-3.5" />提交反馈</Link>
        <Link to="/redeems" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="gift" className="h-3.5 w-3.5" />兑换权益</Link>
      </div>
      </div>
      <Minigong />
      </div>}>

      <div className="coeer-home-columns">
        <HomeFeed data={data} />
        <div className="coeer-home-rail min-w-0 space-y-7">
          <PointsSummaryCard balance={balance} />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold">我的群组</h2>
              <Link to="/groups" className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">全部</Link>
            </div>
            {myGroups.length ? <div className="space-y-1">{myGroups.slice(0, 6).map((group: any) => (
              <Link key={group.id} to="/groups/$slug" params={{ slug: group.slug }} className="coeer-focus flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-muted">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-border bg-muted text-xs font-medium">{group.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="text-xs text-muted-foreground">{groupCategoryLabels[group.category] || group.category}</span>
              </Link>
            ))}</div> : data.feedErrors?.groups ? <p className="text-xs leading-6 text-muted-foreground">暂时无法读取群组，请刷新页面重试。</p> : <p className="text-xs leading-6 text-muted-foreground">还没有加入群组。<Link to="/groups" className="coeer-focus rounded text-primary hover:underline">发现感兴趣的组织</Link></p>}
          </section>
          <RightRail activities={activities} user={user} />
        </div>
      </div>
    </PageLayout>
  )
}

function GuestLanding({ data }: { data: HomeData }) {
  return (
    <div className="min-h-dvh">
      <header className="coeer-guest-header coeer-surface-chrome sticky top-0 z-30 border-b border-border">
        <div className="coeer-container flex h-16 items-center gap-3">
          <Link to="/" className="coeer-focus flex items-center gap-2 rounded-md"><BrandMark className="h-7 w-7 text-primary" /><span className="text-[15px] font-semibold tracking-tight">COEER</span></Link>
          <span className="hidden border-l border-border pl-3 text-xs text-muted-foreground sm:block">学院社区</span>
          <div className="ml-auto flex items-center gap-3"><ThemeToggle /><Button asChild variant="ghost" size="sm"><Link to="/login">登录</Link></Button><Button asChild size="sm"><Link to="/signup">注册账号</Link></Button></div>
        </div>
      </header>
      <main className="coeer-container pb-16">
        <section className="coeer-guest-hero" aria-label="欢迎来到学院社区">
          <div className="coeer-guest-copy">
          <h1>让学院生活，<span className="block">多一点参与。</span></h1>
          <p>看公告、聊想法、提建议，也能参与活动、积累成长积分。</p>
          <div className="coeer-guest-actions"><Button asChild size="lg"><Link to="/login">进入学院社区<Icon name="chevron" className="h-3.5 w-3.5" /></Link></Button><Button asChild variant="secondary" size="lg"><Link to="/signup">创建账号</Link></Button></div>
          </div>
          <div className="coeer-guest-character"><Minigong /></div>
        </section>
        <div className="grid items-start gap-10 border-t border-border pt-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <HomeFeed data={data} />
          <RightRail activities={data.activities} user={null} />
        </div>
      </main>
      <footer className="border-t border-border"><div className="coeer-container flex flex-wrap justify-between gap-3 py-6 text-xs text-muted-foreground"><span>COEER · 学院社区与成长激励系统</span><span>社区协作，从一次参与开始。</span></div></footer>
    </div>
  )
}

function HomeFeed({ data }: { data: HomeData }) {
  const { posts, bulletins, activities, feedbacks, user } = data
  const updates = [
    ...posts.map((post) => ({ kind: 'post' as const, id: post.id, createdAt: post.createdAt, post })),
    ...activities.map((activity) => ({ kind: 'activity' as const, id: activity.id, createdAt: activity.createdAt, activity })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id)).slice(0, HOME_LIMIT)

  return (
    <div className="min-w-0 space-y-6">
      <section aria-labelledby="home-bulletins-title" className="coeer-home-section">
        <div className="coeer-home-section-header">
          <h2 id="home-bulletins-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="bell" className="h-4 w-4 text-muted-foreground" />官方公告</h2>
          <Link to="/bulletins" search={{ type: 'official' }} className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">全部公告<Icon name="chevron" className="ml-1 inline h-3 w-3" /></Link>
        </div>
        {data.feedErrors?.bulletins ? <FeedError message="暂时无法读取官方公告。" /> : null}
        {bulletins.length ? <div>{bulletins.map((bulletin: any) => (
          <article key={bulletin.id} className="coeer-home-item coeer-linked-card">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {bulletin.isPinned ? <Badge tone="primary"><Icon name="bookmark" className="mr-1 inline h-3 w-3" />置顶</Badge> : <Badge>公告</Badge>}
              <span>{formatDate(bulletin.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-[15px] font-medium"><Link to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="coeer-card-link rounded hover:text-primary">{bulletin.title}</Link></h3>
            <PostContent content={bulletin.content} collapsedHeight={140} className="mt-2 text-muted-foreground" />
          </article>
        ))}</div> : data.feedErrors?.bulletins ? null : <p className="p-5 text-sm text-muted-foreground">暂无官方公告。</p>}
      </section>
      <section aria-labelledby="community-feed-title" className="coeer-home-section">
        <div className="coeer-home-section-header">
          <h2 id="community-feed-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="inbox" className="h-4 w-4 text-muted-foreground" />最新动态</h2>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/activities" className="coeer-focus rounded hover:text-foreground">活动</Link>
            <Link to="/groups" className="coeer-focus rounded hover:text-foreground">公开群组<Icon name="chevron" className="ml-1 inline h-3 w-3" /></Link>
          </div>
        </div>
        <div>
          {data.feedErrors?.updates ? <FeedError message="部分动态暂时无法读取。" /> : null}
          {updates.length ? updates.map((update) => update.kind === 'post' ? (
            <PostCard key={'post-' + update.id} post={update.post} variant="home"
              to={'/groups/' + update.post.group.slug + '/posts/' + update.id}
              source={<Link to="/groups/$slug" params={{ slug: update.post.group.slug }} className="coeer-focus rounded hover:text-primary">{update.post.group.name}</Link>} />
          ) : (
            <article key={'activity-' + update.id} className="coeer-home-item coeer-linked-card">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Badge>活动</Badge><span>{formatDate(update.activity.createdAt)}</span><span>{activityStatusLabels[update.activity.status] || update.activity.status}</span></div>
              <h3 className="mt-3 text-[15px] font-medium"><Link to="/activities/$activityId" params={{ activityId: update.id }} className="coeer-card-link rounded hover:text-primary">{update.activity.title}</Link></h3>
              <PostContent content={update.activity.description} collapsedHeight={140} className="mt-2 text-muted-foreground" />
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Icon name="calendar" className="h-3.5 w-3.5" />{formatDate(update.activity.startTime)} · {update.activity.location || '待定地点'}</span>
                <Link to="/activities/$activityId" params={{ activityId: update.id }} className="coeer-focus ml-auto rounded text-primary hover:underline">活动详情<Icon name="chevron" className="ml-1 inline h-3 w-3" /></Link>
              </div>
            </article>
          )) : data.feedErrors?.updates ? null : <EmptyState title="暂无最新动态" description="公开群组的新帖子和活动发布后会出现在这里。" />}
        </div>
      </section>
      <section aria-labelledby="recent-feedback-title" className="coeer-home-section">
        <div className="coeer-home-section-header">
          <h2 id="recent-feedback-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="feedback" className="h-4 w-4 text-muted-foreground" />近期反馈</h2>
          <Link to="/feedbacks" search={{ view: 'public' }} className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">全部公开反馈<Icon name="chevron" className="ml-1 inline h-3 w-3" /></Link>
        </div>
        {data.feedErrors?.feedbacks ? <FeedError message="暂时无法读取近期反馈。" /> : null}
        {feedbacks.length ? <div className="divide-y divide-border">{feedbacks.map((feedback: any) => <FeedbackCard key={feedback.id} feedback={feedback} variant="home" />)}</div> : data.feedErrors?.feedbacks ? null :
          <p className="p-5 text-sm text-muted-foreground">{user ? '暂时没有公开反馈。' : <Link to="/login" search={{ redirect: '/' }} className="coeer-focus rounded hover:text-primary">登录后查看公开反馈。</Link>}</p>}
      </section>
    </div>
  )
}

function FeedError({ message }: { message: string }) {
  const router = useRouter()
  return <div role="status" className="flex flex-wrap items-center gap-3 p-5 text-sm text-muted-foreground">
    <span>{message}</span><Button variant="secondary" size="sm" onClick={() => void router.invalidate()}>重试</Button>
  </div>
}

function RightRail({ activities, user }: {
  activities: any[]
  user: HomeData['user']
}) {
  return (
    <aside className="min-w-0 space-y-7">
      {!user ? <div className="rounded-lg bg-card p-4">
        <h2 className="text-sm font-medium">加入你的学院社区</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">加入群组、提交反馈、参与活动并积累积分。</p>
        <Button asChild size="sm" variant="secondary" className="mt-4"><Link to="/login">立即登录</Link></Button>
      </div> : null}
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">近期活动</h2><Link to="/activities" className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">全部</Link></div>
        {activities.length ? <div className="divide-y divide-border">{activities.slice(0, 4).map((activity: any) => (
          <Link key={activity.id} to="/activities/$activityId" params={{ activityId: activity.id }} className="coeer-focus group flex items-start gap-3 rounded py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon name="calendar" className="h-3.5 w-3.5" /></span>
            <span className="min-w-0"><span className="block line-clamp-2 text-xs font-medium leading-5 group-hover:text-primary">{activity.title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{formatDate(activity.startTime)} · {activity.location || '待定地点'}</span><span className="mt-1 block text-xs text-primary">{activityStatusLabels[activity.status] || activity.status}</span></span>
          </Link>
        ))}</div> : <p className="py-4 text-xs text-muted-foreground">活动发布后会出现在这里。</p>}
      </section>
    </aside>
  )
}
