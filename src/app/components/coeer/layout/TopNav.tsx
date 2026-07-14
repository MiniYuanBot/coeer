import { Link } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { SearchInput } from '../ui/SearchInput'
import { MobileNav } from './MobileNav'
import { navItems } from './navItems'
import { ThemeToggle } from './ThemeToggle'

export function TopNav({ user }: { user: SessionUser }) {
    const [open, setOpen] = React.useState(false)

    return (
        <header className="sticky top-0 z-50 border-b border-[hsl(var(--border)/0.65)] bg-[hsl(var(--background)/0.86)] backdrop-blur-xl">
            <div className="coeer-container flex h-16 items-center gap-3">
                <Link to="/" className="flex shrink-0 items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--primary))] text-sm font-black text-white shadow-md shadow-blue-500/20">
                        C
                    </span>
                    <span className="text-base font-bold tracking-normal">COEER</span>
                </Link>

                <nav className="ml-4 hidden items-center gap-1 lg:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to as any}
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

                <div className="ml-auto flex items-center justify-end gap-2">
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
            </div>
            <MobileNav open={open} onOpenChange={setOpen} user={user} />
        </header>
    )
}
