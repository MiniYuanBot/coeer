import { Link } from '@tanstack/react-router'
import { Button } from '@/components/coeer'
import { BrandMark } from '@/components/coeer/layout/BrandMark'

export function AuthForm({ actionText, onSubmit, status, afterSubmit }: {
    actionText: string
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
    status: 'pending' | 'idle' | 'success' | 'error'
    afterSubmit?: React.ReactNode
}) {
    const isLogin = actionText.toLowerCase().includes('login')
    return (
        <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-20">
            <div className="w-full max-w-[340px]">
                <Link to="/" aria-label="COEER 首页" className="coeer-focus mx-auto flex w-fit items-center gap-2.5 rounded-md">
                    <BrandMark className="h-9 w-9 text-primary" /><span className="text-xl font-semibold tracking-tight">COEER</span>
                </Link>
                <h1 className="mt-9 text-center text-[25px] font-semibold tracking-[-0.025em]">{isLogin ? '欢迎回来' : '创建 COEER 账号'}</h1>
                <p className="mt-2 text-center text-[13px] leading-6 text-muted-foreground">{isLogin ? '继续你的社区协作和成长记录。' : '加入你的学院内部社区。'}</p>
                <form onSubmit={(event) => { event.preventDefault(); onSubmit(event) }} className="mt-8 space-y-5">
                    <label className="block">
                        <span className="text-xs font-medium">邮箱</span>
                        <input type="email" name="email" id="email" autoComplete="email" required placeholder="you@school.edu"
                            className="coeer-focus mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm" />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium">密码</span>
                        <input type="password" name="password" id="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={6} placeholder="至少 6 位"
                            className="coeer-focus mt-2 h-11 w-full rounded-md border border-border bg-background px-3 text-sm" />
                    </label>
                    {afterSubmit ? <div role="alert" className="rounded-md border border-danger/20 bg-danger/5 p-3 text-[13px] text-danger">{afterSubmit}</div> : null}
                    <Button type="submit" loading={status === 'pending'} className="h-11 w-full">{isLogin ? '登录' : '注册'}</Button>
                </form>
                <p className="mt-6 text-center text-xs text-muted-foreground">
                    {isLogin ? '还没有账号？' : '已经有账号？'}{' '}
                    <Link to={isLogin ? '/signup' : '/login'} className="coeer-focus rounded font-medium text-foreground hover:underline">{isLogin ? '创建账号' : '登录'}</Link>
                </p>
                <div className="mt-10 border-t border-border pt-5 text-center"><Link to="/" className="coeer-focus rounded text-xs text-muted-foreground hover:text-foreground">返回学院社区</Link></div>
            </div>
        </main>
    )
}
