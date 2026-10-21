import { BrandMark } from '@/components/coeer/layout/BrandMark'
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AppShell,
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
import { getBulletinFeedFn, getFeedbacksFn, getMyPointBalanceFn, listActivitiesFn, listAllGroupsFn, listMyGroupsFn, listPostsByGroupFn } from '~/functions'

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const user = context.user

    // 公共内容：首页动态流展示官方公开群组的帖子
    const [groupsResult, bulletinsResult, activitiesResult, feedbacksResult, myGroupsResult, pointsResult] =
      await Promise.allSettled([
        listAllGroupsFn({ data: { limit: 8, offset: 0 } }),
        getBulletinFeedFn({ data: { limit: 6, offset: 0 } }),
        listActivitiesFn({ data: { limit: 6, offset: 0 } }),
        getFeedbacksFn({ data: { limit: 6, offset: 0 } }),
        // 登录用户：真实“我的群组”列表；游客不请求（该接口要求登录）
        user ? listMyGroupsFn({ data: { limit: 8, offset: 0 } }) : Promise.resolve(null),
        user ? getMyPointBalanceFn() : Promise.resolve(null),
      ])

    const groups = groupsResult.status === 'fulfilled' ? groupsResult.value?.items ?? [] : []
    const myGroups =
      myGroupsResult.status === 'fulfilled' && myGroupsResult.value?.items
        ? myGroupsResult.value.items.map((member: any) => member.group).filter(Boolean)
        : []
    const officialGroup = groups.find((group: any) => group.slug === 'coeer-official') ?? groups[0]

    const postsResult = officialGroup
      ? await Promise.allSettled([listPostsByGroupFn({ data: { groupId: officialGroup.id, limit: 8, offset: 0 } })])
      : []

    return {
      groups,
      myGroups,
      posts: postsResult[0]?.status === 'fulfilled' ? postsResult[0].value?.items ?? [] : [],
      bulletins: bulletinsResult.status === 'fulfilled' ? bulletinsResult.value?.data?.items ?? [] : [],
      activities: activitiesResult.status === 'fulfilled' ? activitiesResult.value?.data?.items ?? [] : [],
      feedbacks: feedbacksResult.status === 'fulfilled' ? feedbacksResult.value?.items ?? [] : [],
      balance: pointsResult.status === 'fulfilled' ? pointsResult.value?.data?.balance ?? 0 : 0,
      user,
    }
  },
  component: Home,
})

type HomeData = {
  groups: any[]
  myGroups: any[]
  posts: any[]
  bulletins: any[]
  activities: any[]
  feedbacks: any[]
  balance: number
  user: { id: string; role: string; name?: string | null; email: string } | null | undefined
}

function Home() {
  const data = Route.useLoaderData()

  // 登录用户进入 App 外壳（侧边栏 + 移动端抽屉）
  if (data.user) {
    return (
      <AppShell user={data.user}>
        <HomeContent data={data} />
      </AppShell>
    )
  }

  // 游客：无顶部导航栏的品牌页 + 公开动态预览，风格与登录页一致
  return <GuestLanding data={data} />
}

function HomeContent({ data }: { data: HomeData }) {
  const { groups, myGroups, posts, bulletins, activities, feedbacks, balance, user } = data
  const officialGroup = groups.find((group: any) => group.slug === 'coeer-official') ?? groups[0]
  return (
    <div className="coeer-page">
      <SectionHeader title="动态" description="关注学院社区里的活动、公告、帖子和反馈进展。"
        action={<Button asChild><Link to="/feedbacks/create"><Icon name="plus" />提交反馈</Link></Button>} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-border py-3">
        <span className="mr-auto text-xs text-muted-foreground">一起参与学院社区</span>
        <Link to="/groups" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="group" className="h-3.5 w-3.5" />发现群组</Link>
        <Link to="/activities" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="calendar" className="h-3.5 w-3.5" />参与活动</Link>
        <Link to="/redeems" className="coeer-focus inline-flex items-center gap-2 rounded text-xs text-muted-foreground hover:text-foreground"><Icon name="gift" className="h-3.5 w-3.5" />兑换权益</Link>
      </div>
      <div className="coeer-home-columns">
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="community-feed-title">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 id="community-feed-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="inbox" className="h-4 w-4 text-muted-foreground" />官方动态</h2>
              {officialGroup ? <Link to="/groups/$slug" params={{ slug: officialGroup.slug }} className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">进入群组</Link> : null}
            </div>
            <div className="coeer-feed">
              {posts.length ? posts.map((post: any) => <PostCard key={post.id} post={post} to={officialGroup ? '/groups/' + officialGroup.slug + '/posts/' + post.id : undefined} />) :
                <EmptyState title="社区动态还在等待第一条内容" description="加入感兴趣的群组，开始你的社区交流。" action={<Button asChild variant="secondary"><Link to="/groups">发现群组</Link></Button>} />}
            </div>
          </section>
          <section aria-labelledby="recent-feedback-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="recent-feedback-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="feedback" className="h-4 w-4 text-muted-foreground" />最新公开反馈</h2>
              <Link to="/feedbacks" className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">查看全部</Link>
            </div>
            {feedbacks.length ? <div className="divide-y divide-border border-y border-border">{feedbacks.slice(0, 4).map((feedback: any) => <FeedbackCard key={feedback.id} feedback={feedback} variant="row" />)}</div> :
              <p className="py-5 text-[13px] text-muted-foreground">暂时没有公开反馈。</p>}
          </section>
        </div>
        <div className="coeer-home-rail min-w-0 space-y-7">
          <PointsSummaryCard balance={balance} />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold">我的群组</h2>
              <Link to="/groups" className="coeer-focus rounded text-[11px] text-muted-foreground hover:text-foreground">全部</Link>
            </div>
            {myGroups.length ? <div className="space-y-1">{myGroups.slice(0, 6).map((group: any) => (
              <Link key={group.id} to="/groups/$slug" params={{ slug: group.slug }} className="coeer-focus flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] hover:bg-muted">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-border bg-muted/50 text-[11px] font-medium">{group.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1 truncate">{group.name}</span>
                <span className="text-[10px] text-muted-foreground">{groupCategoryLabels[group.category] || group.category}</span>
              </Link>
            ))}</div> : <p className="text-xs leading-6 text-muted-foreground">还没有加入群组。<Link to="/groups" className="coeer-focus rounded text-primary hover:underline">发现感兴趣的组织</Link></p>}
          </section>
          <RightRail data={{ balance, bulletins, activities }} user={user} />
        </div>
      </div>
    </div>
  )
}

function GuestLanding({ data }: { data: HomeData }) {
  const officialGroup = data.groups.find((group: any) => group.slug === 'coeer-official') ?? data.groups[0]
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="coeer-container flex h-16 items-center gap-3">
          <Link to="/" className="coeer-focus flex items-center gap-2 rounded-md"><BrandMark className="h-7 w-7 text-primary" /><span className="text-[15px] font-semibold tracking-tight">COEER</span></Link>
          <span className="hidden border-l border-border pl-3 text-xs text-muted-foreground sm:block">学院社区</span>
          <div className="ml-auto flex items-center gap-3"><ThemeToggle /><Button asChild variant="ghost" size="sm"><Link to="/login">登录</Link></Button><Button asChild size="sm"><Link to="/signup">注册账号</Link></Button></div>
        </div>
      </header>
      <main className="coeer-container pb-16">
        <section className="max-w-3xl py-14 sm:py-20">
          <h1 className="text-[32px] font-semibold leading-[1.35] tracking-[-0.03em] sm:text-[44px]">把学院社区、反馈协作与成长激励放在一个可信赖的地方</h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">COEER：群组与帖子、反馈闭环、公告订阅、活动报名、积分卡片成就与校园权益兑换。</p>
          <div className="mt-7 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/login">进入学院社区<Icon name="chevron" className="h-3.5 w-3.5" /></Link></Button><Button asChild variant="secondary" size="lg"><Link to="/signup">创建账号</Link></Button></div>
        </section>
        <div className="grid items-start gap-10 border-t border-border pt-8 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="guest-feed-title">
            <h2 id="guest-feed-title" className="mb-6 flex items-center gap-2 text-sm font-semibold"><Icon name="inbox" className="text-muted-foreground" />官方动态</h2>
            <div className="coeer-feed">{data.posts.length ? data.posts.map((post: any) => <PostCard key={post.id} post={post} to={officialGroup ? '/groups/' + officialGroup.slug + '/posts/' + post.id : undefined} />) :
              <EmptyState title="官方动态还在准备中" description="登录后即可查看完整动态流。" />}</div>
          </section>
          <RightRail data={{ balance: 0, bulletins: data.bulletins, activities: data.activities }} user={null} />
        </div>
      </main>
      <footer className="border-t border-border"><div className="coeer-container flex flex-wrap justify-between gap-3 py-6 text-xs text-muted-foreground"><span>COEER · 学院社区与成长激励系统</span><span>社区协作，从一次参与开始。</span></div></footer>
    </div>
  )
}

function RightRail({ data, user }: {
  data: { balance: number; bulletins: any[]; activities: any[] }
  user: HomeData['user']
}) {
  return (
    <aside className="min-w-0 space-y-7">
      {!user ? <div className="rounded-lg border border-border bg-muted/30 p-4">
        <h2 className="text-sm font-medium">加入你的学院社区</h2>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">加入群组、提交反馈、参与活动并积累积分。</p>
        <Button asChild size="sm" variant="secondary" className="mt-4"><Link to="/login">立即登录</Link></Button>
      </div> : null}
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">近期活动</h2><Link to="/activities" className="coeer-focus rounded text-[11px] text-muted-foreground hover:text-foreground">全部</Link></div>
        {data.activities.length ? <div className="divide-y divide-border">{data.activities.slice(0, 4).map((activity: any) => (
          <Link key={activity.id} to="/activities/$activityId" params={{ activityId: activity.id }} className="coeer-focus group flex items-start gap-3 rounded py-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground"><Icon name="calendar" className="h-3.5 w-3.5" /></span>
            <span className="min-w-0"><span className="block line-clamp-2 text-xs font-medium leading-5 group-hover:text-primary">{activity.title}</span><span className="mt-1 block text-[11px] leading-5 text-muted-foreground">{formatDate(activity.startTime)} · {activity.location || '待定地点'}</span><span className="mt-1 block text-[10px] text-primary">{activityStatusLabels[activity.status] || activity.status}</span></span>
          </Link>
        ))}</div> : <p className="py-4 text-xs text-muted-foreground">活动发布后会出现在这里。</p>}
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold">学院公告</h2><Link to="/bulletins" className="coeer-focus rounded text-[11px] text-muted-foreground hover:text-foreground">全部</Link></div>
        {data.bulletins.length ? <div className="space-y-1">{data.bulletins.slice(0, 5).map((bulletin: any) => (
          <Link key={bulletin.id} to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="coeer-focus group flex items-start gap-2 rounded py-2">
            <Icon name={bulletin.isPinned ? 'bookmark' : 'bell'} className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 text-xs leading-5 group-hover:text-primary">{bulletin.title}</span>{bulletin.isPinned ? <span className="ml-auto shrink-0 text-[10px] leading-5 text-primary">置顶</span> : null}
          </Link>
        ))}</div> : <p className="py-4 text-xs text-muted-foreground">暂无公告</p>}
      </section>
    </aside>
  )
}
