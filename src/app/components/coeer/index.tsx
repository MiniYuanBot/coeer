import { Link, useRouterState } from '@tanstack/react-router'
import * as React from 'react'

type User = {
    email: string
    name?: string | null
    role: 'student' | 'moderator' | 'admin'
} | null | undefined

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'
type IconName =
    | 'activity'
    | 'award'
    | 'bell'
    | 'bookmark'
    | 'calendar'
    | 'card'
    | 'check'
    | 'chevron'
    | 'coins'
    | 'comment'
    | 'feedback'
    | 'gift'
    | 'group'
    | 'heart'
    | 'home'
    | 'login'
    | 'logout'
    | 'menu'
    | 'moon'
    | 'search'
    | 'send'
    | 'spark'
    | 'sun'
    | 'user'
    | 'x'

function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
    const common = {
        className,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.9,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    }

    const paths: Record<IconName, React.ReactNode> = {
        activity: <><path d="M3 12h4l2-6 4 12 2-6h6" /></>,
        award: <><circle cx="12" cy="8" r="5" /><path d="M8.5 12.5 7 22l5-3 5 3-1.5-9.5" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
        bookmark: <><path d="M6 3h12v18l-6-4-6 4z" /></>,
        calendar: <><path d="M8 2v4M16 2v4M3 10h18" /><rect x="3" y="5" width="18" height="16" rx="2" /></>,
        card: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 8h8M8 12h5" /></>,
        check: <><path d="m5 12 5 5L20 7" /></>,
        chevron: <><path d="m9 18 6-6-6-6" /></>,
        coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
        comment: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /></>,
        feedback: <><path d="M4 4h16v12H7l-3 3z" /><path d="M8 8h8M8 12h5" /></>,
        gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18" /><path d="M7.5 8A2.5 2.5 0 1 1 12 5.5V8M16.5 8A2.5 2.5 0 1 0 12 5.5V8" /></>,
        group: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
        heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></>,
        home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
        login: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="m10 17 5-5-5-5M15 12H3" /></>,
        logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
        menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
        moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
        send: <><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></>,
        spark: <><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" /><path d="M19 15l.7 2.3L22 18l-2.3.7L19 22l-.7-3.3L16 18l2.3-.7z" /></>,
        sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
        user: <><circle cx="12" cy="8" r="4" /><path d="M4 22a8 8 0 0 1 16 0" /></>,
        x: <><path d="M18 6 6 18M6 6l12 12" /></>,
    }

    return <svg {...common}>{paths[name]}</svg>
}

export function Button({
    variant = 'primary',
    size = 'md',
    loading,
    className,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    size?: 'sm' | 'md' | 'lg' | 'icon'
    loading?: boolean
}) {
    return (
        <button
            {...props}
            disabled={props.disabled || loading}
            className={cn(
                'coeer-focus inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:pointer-events-none disabled:opacity-55',
                size === 'sm' && 'h-8 px-3',
                size === 'md' && 'h-10 px-4',
                size === 'lg' && 'h-11 px-5',
                size === 'icon' && 'h-10 w-10',
                variant === 'primary' && 'bg-[hsl(var(--primary))] text-white shadow-sm hover:bg-[hsl(var(--primary)/0.92)]',
                variant === 'secondary' && 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.72)]',
                variant === 'outline' && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]',
                variant === 'ghost' && 'hover:bg-[hsl(var(--muted))]',
                variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
                className,
            )}
        >
            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
        </button>
    )
}

export function Badge({ tone = 'default', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                tone === 'default' && 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
                tone === 'primary' && 'border-[hsl(var(--primary)/0.22)] bg-[hsl(var(--primary)/0.09)] text-[hsl(var(--primary))]',
                tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
                tone === 'warning' && 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
                tone === 'danger' && 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
                tone === 'muted' && 'border-transparent bg-transparent text-[hsl(var(--muted-foreground))]',
                className,
            )}
        >
            {children}
        </span>
    )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
    return <section className={cn('coeer-card', className)}>{children}</section>
}

export function SearchInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <label className="relative block">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
                {...props}
                className={cn(
                    'coeer-focus h-10 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]',
                    props.className,
                )}
            />
        </label>
    )
}

const navItems = [
    { to: '/', label: '动态', icon: 'home' as const },
    { to: '/groups', label: '群组', icon: 'group' as const },
    { to: '/bulletins', label: '公告', icon: 'bell' as const },
    { to: '/activities', label: '活动', icon: 'calendar' as const },
    { to: '/feedbacks', label: '反馈', icon: 'feedback' as const },
    { to: '/redeems', label: '商城', icon: 'gift' as const },
    { to: '/achievements', label: '成就', icon: 'award' as const },
]

function ThemeToggle() {
    const [dark, setDark] = React.useState(false)

    React.useEffect(() => {
        const saved = localStorage.getItem('coeer-theme')
        const next = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', next)
        setDark(next)
    }, [])

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="切换主题"
            onClick={() => {
                const next = !dark
                document.documentElement.classList.toggle('dark', next)
                localStorage.setItem('coeer-theme', next ? 'dark' : 'light')
                setDark(next)
            }}
        >
            <Icon name={dark ? 'sun' : 'moon'} />
        </Button>
    )
}

export function TopNav({ user }: { user: User }) {
    const [open, setOpen] = React.useState(false)

    return (
        <header className="sticky top-0 z-50 border-b border-[hsl(var(--border)/0.65)] bg-[hsl(var(--background)/0.86)] backdrop-blur-xl">
            <div className="coeer-container flex h-16 items-center gap-3">
                <Link to="/" className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--primary))] text-sm font-black text-white shadow-md shadow-blue-500/20">
                        C
                    </span>
                    <span className="text-base font-bold tracking-normal">COEER</span>
                </Link>

                <nav className="ml-4 hidden items-center gap-1 lg:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            activeOptions={item.to === '/' ? { exact: true } : undefined}
                            className="coeer-focus inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' }}
                        >
                            <Icon name={item.icon} />
                            {item.label}
                        </Link>
                    ))}
                    {user?.role === 'admin' ? (
                        <Link
                            to="/admin"
                            className="coeer-focus inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' }}
                        >
                            <Icon name="spark" />
                            管理
                        </Link>
                    ) : null}
                </nav>

                <div className="ml-auto hidden w-56 xl:block">
                    <SearchInput placeholder="搜索群组、活动、反馈" />
                </div>

                <Button type="button" variant="ghost" size="icon" aria-label="通知">
                    <Icon name="bell" />
                </Button>
                <ThemeToggle />
                <Link
                    to={user ? '/profile' : '/login'}
                    className="coeer-focus hidden h-10 items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm hover:bg-[hsl(var(--muted))] sm:flex"
                >
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--primary)/0.12)] text-xs font-semibold text-[hsl(var(--primary))]">
                        {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="max-w-32 truncate">{user?.name || user?.email || '登录'}</span>
                </Link>
                <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="打开导航">
                    <Icon name="menu" />
                </Button>
            </div>
            <MobileNav open={open} onOpenChange={setOpen} user={user} />
        </header>
    )
}

export function MobileNav({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: User }) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 lg:hidden">
            <button className="absolute inset-0 bg-slate-950/35" aria-label="关闭导航" onClick={() => onOpenChange(false)} />
            <aside className="absolute right-0 top-0 h-full w-80 max-w-[86vw] border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-2xl">
                <div className="flex items-center justify-between">
                    <div className="font-semibold">COEER 导航</div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="关闭">
                        <Icon name="x" />
                    </Button>
                </div>
                <div className="mt-4">
                    <SearchInput placeholder="搜索内容" />
                </div>
                <nav className="mt-4 grid gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => onOpenChange(false)}
                            className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-[hsl(var(--muted))]"
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' }}
                        >
                            <Icon name={item.icon} />
                            {item.label}
                        </Link>
                    ))}
                    {user?.role === 'admin' ? (
                        <Link
                            to="/admin"
                            onClick={() => onOpenChange(false)}
                            className="flex h-11 items-center gap-3 rounded-lg px-3 text-sm hover:bg-[hsl(var(--muted))]"
                            activeProps={{ className: 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' }}
                        >
                            <Icon name="spark" />
                            管理
                        </Link>
                    ) : null}
                </nav>
                <div className="mt-6 rounded-lg border border-[hsl(var(--border))] p-3 text-sm">
                    <div className="font-medium">{user?.email || '未登录'}</div>
                    <div className="mt-1 text-[hsl(var(--muted-foreground))]">{user?.role || 'visitor'}</div>
                </div>
            </aside>
        </div>
    )
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
    return (
        <>
            <TopNav user={user} />
            <main className="coeer-container py-6 md:py-8">{children}</main>
        </>
    )
}

type Toast = { id: number; title: string; description?: string; tone?: Tone }
const ToastContext = React.createContext<{ toast: (toast: Omit<Toast, 'id'>) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const toast = React.useCallback((item: Omit<Toast, 'id'>) => {
        const id = Date.now()
        setToasts((prev) => [...prev, { ...item, id }])
        window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3200)
    }, [])

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[70] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
                {toasts.map((item) => (
                    <Card key={item.id} className="p-4">
                        <div className="flex items-start gap-3">
                            <Badge tone={item.tone ?? 'primary'}>{item.tone ?? 'info'}</Badge>
                            <div>
                                <div className="font-medium">{item.title}</div>
                                {item.description ? <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p> : null}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = React.useContext(ToastContext)
    if (!ctx) return { toast: () => undefined }
    return ctx
}

export function Modal({
    open,
    title,
    children,
    onOpenChange,
}: {
    open: boolean
    title: string
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
            <button className="absolute inset-0 bg-slate-950/40" aria-label="关闭弹窗" onClick={() => onOpenChange(false)} />
            <Card className="relative w-full max-w-lg p-5">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        <Icon name="x" />
                    </Button>
                </div>
                <div className="mt-4">{children}</div>
            </Card>
        </div>
    )
}

export function Drawer({
    open,
    title,
    children,
    onOpenChange,
}: {
    open: boolean
    title: string
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[60]">
            <button className="absolute inset-0 bg-slate-950/35" aria-label="关闭抽屉" onClick={() => onOpenChange(false)} />
            <Card className="absolute bottom-0 right-0 top-auto max-h-[88vh] w-full overflow-auto rounded-b-none p-5 md:right-4 md:top-4 md:h-[calc(100vh-2rem)] md:max-h-none md:w-[28rem] md:rounded-lg">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{title}</h2>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        <Icon name="x" />
                    </Button>
                </div>
                <div className="mt-4">{children}</div>
            </Card>
        </div>
    )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <Card className="grid place-items-center p-10 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                <Icon name="spark" />
            </div>
            <h3 className="mt-4 font-semibold">{title}</h3>
            {description ? <p className="mt-2 max-w-md text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            {action ? <div className="mt-5">{action}</div> : null}
        </Card>
    )
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
    return (
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
                <h1 className="text-2xl font-bold tracking-normal md:text-3xl">{title}</h1>
                {description ? <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">{description}</p> : null}
            </div>
            {action}
        </div>
    )
}

export function PointsSummaryCard({ balance = 0, streak = 7 }: { balance?: number; streak?: number }) {
    return (
        <Card className="p-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-[hsl(var(--muted-foreground))]">我的积分</p>
                    <div className="mt-2 text-3xl font-bold text-[hsl(var(--primary))]">{balance}</div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]">
                    <Icon name="coins" className="h-5 w-5" />
                </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${Math.min(100, Math.max(12, balance / 8))}%` }} />
            </div>
            <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">连续活跃 {streak} 天，完成反馈和活动可以继续成长。</p>
        </Card>
    )
}

export function GroupCard({ group }: { group: any }) {
    return (
        <Link to="/groups/$slug" params={{ slug: group.slug }} className="block">
            <Card className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate font-semibold">{group.name}</h3>
                        <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{group.description || '暂无简介'}</p>
                    </div>
                    <Badge tone={group.status === 'approved' ? 'success' : 'warning'}>{group.status}</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{group.category}</span>
                    <span>{group.isPublic ? '公开' : '私密'}</span>
                </div>
            </Card>
        </Link>
    )
}

export function PostCard({ post, to }: { post: any; to?: string }) {
    const content = (
        <Card className="p-5">
            <div className="flex items-center gap-2">
                <Badge tone={post.isPinned ? 'primary' : 'default'}>{post.isPinned ? '置顶' : post.type}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(post.createdAt)}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">{post.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{post.content}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-1"><Icon name="heart" /> 点赞</span>
                <span className="inline-flex items-center gap-1"><Icon name="comment" /> 回复</span>
            </div>
        </Card>
    )
    if (!to) return content
    return <Link to={to as any} className="block">{content}</Link>
}

export function BulletinCard({ bulletin }: { bulletin: any }) {
    return (
        <Link to="/bulletins/$bulletinId" params={{ bulletinId: bulletin.id }} className="block">
            <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <Badge tone={bulletin.isPinned ? 'primary' : 'default'}>{bulletin.type}</Badge>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(bulletin.createdAt)}</span>
                </div>
                <h3 className="mt-3 font-semibold">{bulletin.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{bulletin.content}</p>
            </Card>
        </Link>
    )
}

export function ActivityCard({ activity, action }: { activity: any; action?: React.ReactNode }) {
    return (
        <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
                <Badge tone={activity.status === 'completed' ? 'success' : 'primary'}>{activity.status}</Badge>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(activity.startTime)}</span>
            </div>
            <h3 className="mt-3 font-semibold">{activity.title}</h3>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{activity.description}</p>
            <div className="mt-4 grid gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <span className="inline-flex items-center gap-2"><Icon name="calendar" /> {formatDateTime(activity.startTime)}</span>
                <span className="inline-flex items-center gap-2"><Icon name="bookmark" /> {activity.location || '待定地点'}</span>
            </div>
            {action ? <div className="mt-5">{action}</div> : null}
        </Card>
    )
}

export function FeedbackCard({ feedback }: { feedback: any }) {
    const tone = feedback.status === 'resolved' ? 'success' : feedback.status === 'processing' ? 'primary' : feedback.status === 'invalid' ? 'danger' : 'warning'
    return (
        <Link to="/feedbacks/$feedbackId" params={{ feedbackId: feedback.id }} className="block">
            <Card className="p-5">
                <div className="flex items-center gap-2">
                    <Badge tone={tone}>{feedback.status}</Badge>
                    {feedback.isAnonymous ? <Badge>匿名</Badge> : null}
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(feedback.createdAt)}</span>
                </div>
                <h3 className="mt-3 font-semibold">{feedback.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{feedback.content}</p>
            </Card>
        </Link>
    )
}

export function AchievementCard({ achievement, unlocked }: { achievement: any; unlocked?: boolean }) {
    const item = achievement.achievement ?? achievement
    return (
        <Card className={cn('p-5', !unlocked && 'opacity-75')}>
            <div className="flex items-start gap-4">
                <div className={cn('grid h-12 w-12 place-items-center rounded-lg', unlocked ? 'bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                    <Icon name="award" className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.name}</h3>
                        {unlocked ? <Badge tone="success">已解锁</Badge> : <Badge>未解锁</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: unlocked ? '100%' : '36%' }} />
                    </div>
                </div>
            </div>
        </Card>
    )
}

export function RedeemItemCard({ item, action }: { item: any; action?: React.ReactNode }) {
    return (
        <Card className="overflow-hidden">
            <div className="grid aspect-[4/2.3] place-items-center bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> : <Icon name="gift" className="h-10 w-10" />}
            </div>
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{item.name}</h3>
                    <Badge tone={item.status === 'active' ? 'success' : 'warning'}>{item.status}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[hsl(var(--muted-foreground))]">{item.description || '暂无说明'}</p>
                <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-semibold text-[hsl(var(--primary))]"><Icon name="coins" /> {item.pointsCost}</span>
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">库存 {item.stock === -1 ? '不限' : item.stock}</span>
                </div>
                {action ? <div className="mt-4">{action}</div> : null}
            </div>
        </Card>
    )
}

export function CommentList({ comments = [] }: { comments?: any[] }) {
    if (!comments.length) return <EmptyState title="还没有回复" description="发起第一条有价值的讨论。" />
    return (
        <div className="grid gap-3">
            {comments.map((comment) => (
                <Card key={comment.id} className="p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium">{comment.user?.name || '成员'}</span>
                        <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatDate(comment.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{comment.content}</p>
                </Card>
            ))}
        </div>
    )
}

export function useAsyncAction() {
    const { toast } = useToast()
    const [loadingKey, setLoadingKey] = React.useState<string | null>(null)

    async function run(key: string, action: () => Promise<unknown>, messages: { loading?: string; success: string; error: string }) {
        setLoadingKey(key)
        try {
            await action()
            toast({ title: messages.success, tone: 'success' })
        } catch (error) {
            toast({ title: messages.error, description: error instanceof Error ? error.message : undefined, tone: 'danger' })
        } finally {
            setLoadingKey(null)
        }
    }

    return { loadingKey, run }
}

export function PageStatus() {
    const status = useRouterState({ select: (state) => state.status })
    if (status !== 'pending') return null
    return <div className="fixed left-0 right-0 top-0 z-[80] h-0.5 animate-pulse bg-[hsl(var(--primary))]" />
}

export function formatDate(value?: string | Date | null) {
    if (!value) return '刚刚'
    return new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export function formatDateTime(value?: string | Date | null) {
    if (!value) return '待定'
    return new Date(value).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
