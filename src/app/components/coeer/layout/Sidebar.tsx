import { Link } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'
import { adminNavItem, navSections } from './navItems'

export function Sidebar({ user, open, onClose, onSearch }: {
    user: SessionUser; open: boolean; onClose: () => void; onSearch: () => void
}) {
    const drawer = React.useRef<HTMLDialogElement>(null)
    React.useEffect(() => {
        const dialog = drawer.current
        if (!dialog) return
        if (open && !dialog.open) dialog.showModal()
        if (!open && dialog.open) dialog.close()
        if (!open) return
        const closeOnDesktop = () => { if (window.innerWidth >= 1024) onClose() }
        window.addEventListener('resize', closeOnDesktop)
        return () => window.removeEventListener('resize', closeOnDesktop)
    }, [open, onClose])
    return (
        <>
            <dialog ref={drawer} aria-label="主导航" className="coeer-mobile-drawer" onCancel={onClose} onClose={onClose}
                onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
                <SidebarBody user={user} onNavigate={onClose} onSearch={() => { onClose(); onSearch() }} />
            </dialog>
            <aside aria-label="主导航" className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-border bg-sidebar lg:flex">
                <SidebarBody user={user} onSearch={onSearch} />
            </aside>
        </>
    )
}

function SidebarBody({ user, onNavigate, onSearch }: {
    user: SessionUser; onNavigate?: () => void; onSearch: () => void
}) {
    const roles: Record<string, string> = { student: '学生', moderator: '社区管理员', admin: '平台管理员' }
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-5">
                <Link to="/" onClick={onNavigate} className="coeer-focus flex min-w-0 items-center gap-2.5 rounded-md">
                    <BrandMark className="h-7 w-7 shrink-0 text-primary" />
                    <span className="text-[15px] font-semibold tracking-[-0.025em]">COEER</span>
                </Link>
                {onNavigate ? <button type="button" aria-label="关闭导航" onClick={onNavigate} className="coeer-focus ml-auto rounded p-2 text-muted-foreground"><Icon name="x" /></button> : null}
            </div>
            <div className="px-3">
                <button type="button" onClick={onSearch} aria-label="搜索页面" className="coeer-focus flex h-8 w-full items-center gap-2 rounded-md border border-border bg-background/70 px-2.5 text-xs text-muted-foreground hover:border-primary/40">
                    <Icon name="search" className="h-3.5 w-3.5" /><span>搜索页面</span><kbd className="coeer-kbd ml-auto">⌘ K</kbd>
                </button>
            </div>
            <nav className="coeer-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-6">
                <div className="grid gap-6">
                    {navSections.map((section) => (
                        <div key={section.label}>
                            <div className="px-2.5 pb-2 text-[11px] font-medium text-muted-foreground">{section.label}</div>
                            <div className="grid gap-0.5">
                                {section.items.map((item) => (
                                    <Link key={item.to} to={item.to as any} activeOptions={item.active === 'exact' ? { exact: true } : undefined}
                                        onClick={onNavigate} className="coeer-focus coeer-nav-link">
                                        <Icon name={item.icon} className="h-4 w-4 shrink-0" />{item.label}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                    {user?.role === 'admin' ? (
                        <div>
                            <div className="px-2.5 pb-2 text-[11px] font-medium text-muted-foreground">管理</div>
                            <Link to={adminNavItem.to as any} onClick={onNavigate} className="coeer-focus coeer-nav-link"><Icon name={adminNavItem.icon} />{adminNavItem.label}</Link>
                        </div>
                    ) : null}
                </div>
            </nav>
            <div className="shrink-0 border-t border-border px-3 py-3">
                <div className="mb-3 flex items-center justify-between px-2"><span className="text-xs text-muted-foreground">外观</span><ThemeToggle /></div>
                <div className="flex items-center gap-2 px-1">
                    <Link to="/profile" onClick={onNavigate} className="coeer-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{user?.name || user?.email || '未登录'}</span>
                            <span className="mt-0.5 block text-[11px] text-muted-foreground">{roles[user?.role || ''] || '访客'}</span>
                        </span>
                    </Link>
                    <Link to="/logout" onClick={onNavigate} aria-label="退出登录" title="退出登录" className="coeer-focus rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Icon name="logout" className="h-3.5 w-3.5" /></Link>
                </div>
            </div>
        </div>
    )
}
