import { createFileRoute, Link } from '@tanstack/react-router'
import {
  AppShell,
  Badge,
  Button,
  Card,
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
  const { myGroups, posts, bulletins, activities, feedbacks, balance, user } = data

  return (
    <div className="space-y-6">
      <SectionHeader
        title="动态"
        description="关注学院社区里的活动、公告、帖子和反馈进展。"
        action={
          <Link to="/feedbacks/create">
            <Button>
              <Icon name="send" />
              提交反馈
            </Button>
          </Link>
        }
      />

      {/* 两栏：主内容 + 右侧信息栏；窄屏自动单列堆叠 */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon name="spark" className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-medium text-foreground">今天想一起推进什么？</div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">发帖、反馈、报名活动，都会沉淀成你的成长记录。</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/feedbacks/create">
                <Button size="sm">
                  <Icon name="send" />
                  提交反馈
                </Button>
              </Link>
              <Link to="/groups">
                <Button variant="outline" size="sm">
                  <Icon name="group" />
                  找群组
                </Button>
              </Link>
              <Link to="/activities">
                <Button variant="outline" size="sm">
                  <Icon name="calendar" />
                  看活动
                </Button>
              </Link>
              <Link to="/redeems">
                <Button variant="outline" size="sm">
                  <Icon name="gift" />
                  逛商城
                </Button>
              </Link>
            </div>
          </Card>

          {/* 我的群组：横向胶囊快捷入口（取代旧左栏，充分利用主栏宽度） */}
          {myGroups.length ? (
            <Card className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="inline-flex items-center gap-1.5 px-1 text-[13px] font-medium text-foreground">
                <Icon name="group" className="h-4 w-4 text-primary" />
                我的群组
              </span>
              {myGroups.slice(0, 6).map((group: any) => (
                <Link
                  key={group.id}
                  to="/groups/$slug"
                  params={{ slug: group.slug }}
                  className="coeer-focus inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary"
                >
                  <span className="truncate">{group.name}</span>
                  <Badge className="shrink-0 rounded-md px-1.5 py-0">
                    {groupCategoryLabels[group.category] || group.category}
                  </Badge>
                </Link>
              ))}
              <Link
                to="/groups"
                className="coeer-focus inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-primary hover:underline"
              >
                全部
                <Icon name="chevron" className="h-3 w-3 rotate-90" />
              </Link>
            </Card>
          ) : (
            <Card className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-[13px] text-muted-foreground">还没有加入群组，去发现感兴趣的组织吧。</span>
              <Link to="/groups">
                <Button variant="outline" size="sm">
                  <Icon name="group" />
                  去群组中心
                </Button>
              </Link>
            </Card>
          )}

          {posts.length ? (
            posts.map((post: any) => <PostCard key={post.id} post={post} />)
          ) : (
            <EmptyState title="动态还在等待第一条内容" description="运行种子数据或加入群组后，这里会显示帖子流。" />
          )}

          {feedbacks.length ? (
            <div>
              <div className="flex items-center justify-between px-1 pb-2">
                <h2 className="text-[15px] font-medium">最新公开反馈</h2>
                <Link to="/feedbacks" className="text-xs text-primary hover:underline">
                  更多
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {feedbacks.slice(0, 4).map((feedback: any) => (
                  <FeedbackCard key={feedback.id} feedback={feedback} />
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <RightRail data={{ balance, bulletins, activities }} user={user} />
      </div>
    </div>
  )
}

/** 游客品牌页：无导航，只保留品牌与登录/注册入口 + 公开内容预览。 */
function GuestLanding({ data }: { data: HomeData }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="fixed right-4 top-4 z-40">
        <ThemeToggle />
      </div>

      {/* 品牌区（与登录页一致的居中版式，无任何导航链接） */}
      <section className="coeer-container flex flex-col items-center px-2 pb-8 pt-12 text-center md:pt-16">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-md shadow-primary/20">
          C
        </div>
        <h1 className="mt-6 max-w-2xl text-3xl font-bold leading-tight tracking-tight md:text-4xl">
          把学院社区、反馈协作与成长激励放在一个可信赖的地方
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          COEER：群组与帖子、反馈闭环、公告订阅、活动报名、积分卡片成就与校园权益兑换。
        </p>
        <div className="mt-8 flex w-full flex-wrap items-center justify-center gap-3 sm:w-auto">
          <Link to="/login" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto">
              <Icon name="login" />
              登录
            </Button>
          </Link>
          <Link to="/signup" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              注册账号
            </Button>
          </Link>
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
          向下滚动预览社区内容
        </p>
      </section>

      {/* 平台公告横幅：置顶公告优先展示，占满整行 */}
      {data.bulletins.length ? (
        <section className="coeer-container pb-6">
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="flex items-center gap-2 text-[15px] font-medium">
              <Icon name="bell" className="h-4 w-4 text-primary" />
              平台公告
            </h2>
            <Link to="/bulletins" className="text-xs text-primary hover:underline">
              全部公告
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.bulletins.slice(0, 3).map((bulletin: any) => (
              <Link
                key={bulletin.id}
                to="/bulletins/$bulletinId"
                params={{ bulletinId: bulletin.id }}
                className="coeer-focus group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon name={bulletin.isPinned ? 'spark' : 'bell'} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {bulletin.title}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">{bulletin.content}</span>
                </span>
                {bulletin.isPinned ? <Badge className="ml-auto shrink-0">置顶</Badge> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* 公开动态预览 */}
      <main className="coeer-container flex-1 pb-12">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 px-1 text-[15px] font-medium">
              <Icon name="spark" className="h-4 w-4 text-primary" />
              官方动态
            </h2>
            {data.posts.length ? (
              data.posts.map((post: any) => <PostCard key={post.id} post={post} />)
            ) : (
              <EmptyState title="官方动态还在准备中" description="登录后即可查看完整动态流。" />
            )}
          </section>

          <RightRail
            data={{ balance: 0, bulletins: data.bulletins, activities: data.activities }}
            user={null}
            showBulletins={false}
          />
        </div>
      </main>
    </div>
  )
}

/** 右侧栏：积分卡（登录）/ 加入 CTA（游客）+ 近期活动 + 公告 */
function RightRail({
  data,
  user,
  showBulletins = true,
}: {
  data: { balance: number; bulletins: any[]; activities: any[] }
  user: HomeData['user']
  showBulletins?: boolean
}) {
  const isMember = !!user

  return (
    <aside className={`space-y-4 ${isMember ? 'lg:sticky lg:top-6' : ''}`}>
      {isMember ? <PointsSummaryCard balance={data.balance} /> : null}

      {isMember ? null : (
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <Icon name="coins" />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">登录解锁更多</div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">加入群组、提交反馈、参与活动并积累积分。</p>
              <Link to="/login" className="mt-2 inline-block">
                <Button size="sm">立即登录</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-medium">近期活动</h2>
          <Link to="/activities" className="text-xs text-primary hover:underline">
            更多
          </Link>
        </div>
        {data.activities.length ? (
          <div className="-mx-1 grid gap-1">
            {data.activities.slice(0, 4).map((activity: any) => (
              <Link
                key={activity.id}
                to="/activities/$activityId"
                params={{ activityId: activity.id }}
                className="coeer-focus rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block line-clamp-1 text-sm font-medium text-foreground">{activity.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {activity.location || '待定地点'} · {formatDate(activity.startTime)}
                    </span>
                  </span>
                  <Badge
                    tone={activity.status === 'ongoing' ? 'success' : activity.status === 'upcoming' ? 'primary' : 'default'}
                    className="shrink-0"
                  >
                    {activityStatusLabels[activity.status] || activity.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-muted-foreground">暂无活动</p>
        )}
      </Card>

      {showBulletins ? (
        <Card className="overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-medium">公告</h2>
            <Link to="/bulletins" className="text-xs text-primary hover:underline">
              更多
            </Link>
          </div>
          {data.bulletins.length ? (
            <div className="-mx-1 grid gap-1">
              {data.bulletins.slice(0, 5).map((bulletin: any) => (
                <Link
                  key={bulletin.id}
                  to="/bulletins/$bulletinId"
                  params={{ bulletinId: bulletin.id }}
                  className="coeer-focus flex items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-muted/70"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                    <Icon name={bulletin.isPinned ? 'spark' : 'bell'} className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{bulletin.title}</span>
                  <Badge tone={bulletin.isPinned ? 'primary' : 'default'} className="shrink-0">
                    {bulletin.isPinned ? '置顶' : '公告'}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-[13px] text-muted-foreground">暂无公告</p>
          )}
        </Card>
      ) : null}
    </aside>
  )
}
