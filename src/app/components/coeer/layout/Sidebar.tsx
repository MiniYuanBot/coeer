import { Link, useLocation } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { BrandMark } from './BrandMark'
import { ThemeToggle } from './ThemeToggle'
import { adminNavItem, adminNavItems, navSections } from './navItems'
import { useDialog } from '../hooks/useDialog'

export function Sidebar({ user, open, onClose, onSearch }: {
    user: SessionUser; open: boolean; onClose: () => void; onSearch: () => void
}) {
    const drawer = useDialog(open)
    React.useEffect(() => {
        if (!open) return
        const closeOnDesktop = () => { if (window.innerWidth >= 1024) onClose() }
        window.addEventListener('resize', closeOnDesktop)
        return () => window.removeEventListener('resize', closeOnDesktop)
    }, [open, onClose])
    return (
        <>
            <dialog ref={drawer} aria-label="主导航" className="coeer-mobile-drawer coeer-surface-floating" onCancel={onClose} onClose={onClose}
                onClick={(event) => {
                    if (event.target !== event.currentTarget) return
                    const bounds = event.currentTarget.getBoundingClientRect()
                    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
                }}>
                <SidebarBody user={user} onNavigate={onClose} onSearch={() => { onClose(); onSearch() }} />
            </dialog>
            <aside aria-label="主导航" className="coeer-surface-chrome fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-border lg:flex">
                <SidebarBody user={user} onSearch={onSearch} />
            </aside>
        </>
    )
}

function SidebarBody({ user, onNavigate, onSearch }: {
    user: SessionUser; onNavigate?: () => void; onSearch: () => void
}) {
    const roles: Record<string, string> = { student: '学生', moderator: '社区管理员', admin: '平台管理员' }
    const inAdmin = useLocation({ select: location => location.pathname.startsWith('/admin') })
    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-5">
                <Link to="/" onClick={onNavigate} className="coeer-focus flex min-w-0 items-center gap-2.5 rounded-md">
                    <BrandMark className="h-7 w-7 shrink-0 text-primary" />
                    <span className="text-[15px] font-semibold ">COEER</span>
                </Link>
                {onNavigate ? <button type="button" aria-label="关闭导航" onClick={onNavigate} className="coeer-focus ml-auto grid h-11 w-11 place-items-center rounded text-muted-foreground"><Icon name="x" /></button> : null}
            </div>
            <div className="px-3">
                <button type="button" data-command-trigger onClick={onSearch} aria-label="搜索页面" className="coeer-focus coeer-button coeer-button-quiet flex min-h-9 w-full items-center gap-2 rounded-md border border-transparent px-2.5 text-xs text-foreground">
                    <Icon name="search" className="h-3.5 w-3.5" /><span>搜索页面</span><kbd className="coeer-kbd ml-auto">Ctrl K</kbd>
                </button>
            </div>
            <nav className="coeer-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-6">
                <div className="grid gap-5">
                    {inAdmin ? <Link to="/" onClick={onNavigate} className="coeer-focus coeer-nav-link"><Icon name="chevron" className="h-4 w-4 rotate-180" />返回学院社区</Link> : navSections.map((section) => (
                        <div key={section.label}>
                            <div className="px-2.5 pb-2 text-xs font-medium text-muted-foreground">{section.label}</div>
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
                            <div className="px-2.5 pb-2 text-xs font-medium text-muted-foreground">管理</div>
                            <Link to={adminNavItem.to as any} activeOptions={{ exact: inAdmin }} onClick={onNavigate} className="coeer-focus coeer-nav-link"><Icon name={adminNavItem.icon} />{inAdmin ? '管理工作台' : adminNavItem.label}</Link>
                            {inAdmin ? <div className="mt-2 grid gap-0.5">
                                {adminNavItems.filter(item => item.to !== '/admin').map(item => <Link key={item.to} to={item.to as any}
                                    activeOptions={{ exact: item.active === 'exact' }} onClick={onNavigate}
                                    className="coeer-focus coeer-nav-link"><Icon name={item.icon} className="h-4 w-4" />{item.label}</Link>)}
                            </div> : null}
                        </div>
                    ) : null}
                </div>
            </nav>
            <div className="coeer-sidebar-footer shrink-0 border-t border-border px-3 py-3">
                <Link to="/profile" onClick={onNavigate} className="coeer-focus mb-2 block rounded-md px-2 py-2 text-xs text-muted-foreground hover:bg-muted">设置</Link>
                <div className="mb-3 flex items-center justify-between px-2"><span className="text-xs text-muted-foreground">外观</span><ThemeToggle /></div>
                <div className="flex items-center gap-2 px-1">
                    <Link to="/profile" onClick={onNavigate} className="coeer-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{user?.name || user?.email || '未登录'}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{roles[user?.role || ''] || '访客'}</span>
                        </span>
                    </Link>
                    <Link to="/logout" onClick={onNavigate} aria-label="退出登录" title="退出登录" className="coeer-focus rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Icon name="logout" className="h-3.5 w-3.5" /></Link>
                </div>
            </div>
        </div>
    )
}
