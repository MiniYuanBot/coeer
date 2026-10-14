import { Link, useLocation } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { Sidebar } from './Sidebar'
import { CommandMenu } from './CommandMenu'
import { navItems, adminNavItem } from './navItems'

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const [searchOpen, setSearchOpen] = React.useState(false)
    const closeNav = React.useCallback(() => setOpen(false), [])
    const closeSearch = React.useCallback(() => setSearchOpen(false), [])
    const pathname = useLocation({ select: (location) => location.pathname })
    const current = [...navItems, adminNavItem, { to: '/profile', label: '个人中心', icon: 'user' as const }]
        .find((item) => item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(item.to + '/'))
    React.useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault(); setOpen(false); setSearchOpen((value) => !value)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])
    React.useEffect(() => { setOpen(false); setSearchOpen(false) }, [pathname])
    React.useEffect(() => {
        if (!open && !searchOpen) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = previous }
    }, [open, searchOpen])
    return (
        <div className="min-h-dvh bg-background">
            <a href="#main-content" className="coeer-skip">跳到主要内容</a>
            <Sidebar user={user} open={open} onClose={closeNav} onSearch={() => setSearchOpen(true)} />
            <div className="flex min-h-dvh min-w-0 flex-col lg:pl-[232px]">
                <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
                    <button type="button" aria-label="打开导航" aria-expanded={open} onClick={() => setOpen(true)} className="coeer-focus rounded p-1.5 text-muted-foreground hover:bg-muted lg:hidden"><Icon name="panel" /></button>
                    <nav aria-label="当前位置" className="flex min-w-0 items-center gap-2.5 text-xs">
                        <Link to="/" className="coeer-focus hidden rounded text-muted-foreground hover:text-foreground sm:block">学院社区</Link>
                        <Icon name="chevron" className="hidden h-3 w-3 text-muted-foreground/60 sm:block" />
                        <span className="inline-flex items-center gap-2 truncate font-medium"><Icon name={current?.icon || 'home'} className="h-3.5 w-3.5 text-muted-foreground" />{current?.label || '学院社区'}</span>
                    </nav>
                    <button type="button" aria-label="搜索页面" onClick={() => setSearchOpen(true)} className="coeer-focus ml-auto rounded p-2 text-muted-foreground hover:bg-muted"><Icon name="search" /></button>
                    <Link to="/profile" aria-label="个人中心" className="coeer-focus grid h-6 w-6 place-items-center rounded-full bg-primary-soft text-[10px] font-medium text-primary lg:hidden">{(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}</Link>
                </header>
                <main id="main-content" tabIndex={-1} className="coeer-workspace min-w-0 flex-1">{children}</main>
            </div>
            <CommandMenu user={user} open={searchOpen} onClose={closeSearch} />
        </div>
    )
}
