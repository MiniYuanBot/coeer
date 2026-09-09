import { Link } from '@tanstack/react-router'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { ThemeToggle } from './ThemeToggle'
import { adminNavItem, navSections } from './navItems'

export function Sidebar({
    user,
    open,
    onClose,
}: {
    user: SessionUser
    open: boolean
    onClose: () => void
}) {
    return (
        <>
            {/* Mobile drawer (below lg) */}
            {open ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="关闭导航"
                        className="coeer-anim-backdrop absolute inset-0 bg-black/25 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <div className="coeer-anim-panel-left absolute inset-y-0 left-0 w-72 max-w-[86vw] bg-background shadow-2xl">
                        <SidebarBody user={user} onNavigate={onClose} />
                    </div>
                </div>
            ) : null}

            {/* Desktop sidebar (lg+) */}
            <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card lg:flex">
                <SidebarBody user={user} />
            </aside>
        </>
    )
}

function SidebarBody({
    user,
    onNavigate,
}: {
    user: SessionUser
    onNavigate?: () => void
}) {
    const handleClick = onNavigate ? { onClick: onNavigate } : {}

    return (
        <div className="flex h-full min-h-0 flex-col">
            {/* Brand */}
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-5">
                <Link
                    to="/"
                    {...handleClick}
                    className="coeer-focus flex items-center gap-2.5 rounded-lg"
                >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary font-black text-primary-foreground shadow-sm">
                        C
                    </span>
                    <span className="text-[15px] font-bold tracking-tight text-foreground">COEER</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="coeer-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <div className="grid gap-6">
                    {navSections.map((section) => (
                        <div key={section.label}>
                            <div className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
                                {section.label}
                            </div>
                            <div className="grid gap-0.5">
                                {section.items.map((item) => (
                                    <NavLink key={item.to} to={item.to} active={item.active} onClick={onNavigate}>
                                        <Icon name={item.icon} className="h-4 w-4" />
                                        {item.label}
                                    </NavLink>
                                ))}
                            </div>
                        </div>
                    ))}

                    {user?.role === 'admin' ? (
                        <div>
                            <div className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">管理</div>
                            <NavLink to={adminNavItem.to} active={adminNavItem.active} onClick={onNavigate}>
                                <Icon name={adminNavItem.icon} className="h-4 w-4" />
                                {adminNavItem.label}
                            </NavLink>
                        </div>
                    ) : null}
                </div>
            </nav>

            {/* Footer: theme + account */}
            <div className="shrink-0 border-t border-border p-3">
                <div className="mb-1 flex items-center justify-between rounded-lg px-1.5 py-1">
                    <span className="text-xs font-medium text-muted-foreground">外观</span>
                    <ThemeToggle />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <Link
                        to="/profile"
                        {...handleClick}
                        className="coeer-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-md py-0.5"
                    >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                            {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                                {user?.name || user?.email || '未登录'}
                            </span>
                            <span className="block text-xs capitalize text-muted-foreground">
                                {user ? user.role : '访客'}
                            </span>
                        </span>
                    </Link>
                    <Link
                        to="/logout"
                        {...handleClick}
                        aria-label="退出登录"
                        title="退出登录"
                        className="coeer-focus grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        <Icon name="logout" className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    )
}

function NavLink({
    to,
    active = 'prefix',
    children,
    onClick,
}: {
    to: string
    active?: 'exact' | 'prefix'
    children: React.ReactNode
    onClick?: () => void
}) {
    const activeClass =
        'bg-primary-soft font-medium text-primary'
    const idleClass = 'text-muted-foreground hover:bg-muted hover:text-foreground'

    return (
        <Link
            to={to as any}
            activeOptions={active === 'exact' ? { exact: true } : undefined}
            activeProps={{ className: activeClass }}
            onClick={onClick}
            className={`coeer-focus flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${idleClass}`}
        >
            {children}
        </Link>
    )
}
