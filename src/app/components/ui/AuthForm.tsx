import { Link } from '@tanstack/react-router'
import { Badge, Button, Card, Icon } from '@/components/coeer'

export function AuthForm({
  actionText,
  onSubmit,
  status,
  afterSubmit,
}: {
  actionText: string
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  status: 'pending' | 'idle' | 'success' | 'error'
  afterSubmit?: React.ReactNode
}) {
  const isLogin = actionText.toLowerCase().includes('login')

  return (
    <div className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-5xl items-center gap-8 py-8 md:grid-cols-[1.05fr_0.95fr]">
      <div className="hidden md:block">
        <Badge tone="primary">COEER Growth Community</Badge>
        <h1 className="mt-5 text-4xl font-bold leading-tight tracking-normal">
          把学院社区、反馈协作和成长激励放在一个可信赖的地方。
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[hsl(var(--muted-foreground))]">
          登录后可以加入群组、参与活动、提交反馈、领取积分、收集卡片并兑换校园权益。
        </p>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            ['group', '社区协作'],
            ['feedback', '反馈闭环'],
            ['award', '成长激励'],
          ].map(([icon, label]) => (
            <Card key={label} className="p-4">
              <Icon name={icon as any} className="h-5 w-5 text-[hsl(var(--primary))]" />
              <div className="mt-3 text-sm font-medium">{label}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="mx-auto w-full max-w-md p-6 md:p-8">
        <div className="mb-6">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-[hsl(var(--primary))] font-black text-white">C</div>
          <h2 className="mt-5 text-2xl font-bold">{isLogin ? '欢迎回来' : '创建 COEER 账号'}</h2>
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            {isLogin ? '继续你的社区协作和成长记录。' : '加入你的学院内部社区。'}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(e)
          }}
          className="space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium">邮箱</span>
            <input
              type="email"
              name="email"
              id="email"
              required
              placeholder="you@school.edu"
              className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">密码</span>
            <input
              type="password"
              name="password"
              id="password"
              required
              minLength={6}
              placeholder="至少 6 位"
              className="coeer-focus mt-2 h-11 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm"
            />
          </label>

          <Button type="submit" variant="primary" loading={status === 'pending'} className="w-full">
            {isLogin ? '登录' : '注册'}
          </Button>

          {afterSubmit ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">{afterSubmit}</div> : null}

          <div className="flex items-center justify-between text-sm text-[hsl(var(--muted-foreground))]">
            <Link to="/" className="hover:text-[hsl(var(--primary))]">返回动态</Link>
            <Link to={isLogin ? '/signup' : '/login'} className="font-medium text-[hsl(var(--primary))]">
              {isLogin ? '创建账号' : '已有账号'}
            </Link>
          </div>
        </form>
      </Card>
    </div>
  )
}
