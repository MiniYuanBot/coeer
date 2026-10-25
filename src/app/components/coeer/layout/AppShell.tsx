import { BulletinNotices } from '../feedback/BulletinNotices'
import { Avatar } from '../ui/Avatar'
import { Link, useLocation } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { Sidebar } from './Sidebar'
import { CommandMenu } from './CommandMenu'
import { getBreadcrumbs } from './navItems'
import { NotificationBell } from './NotificationBell'

export function AppShell({ user, children }: { user: NonNullable<SessionUser> & { id: string }; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const [searchOpen, setSearchOpen] = React.useState(false)
    const closeNav = React.useCallback(() => setOpen(false), [])
    const closeSearch = React.useCallback(() => setSearchOpen(false), [])
    const pathname = useLocation({ select: (location) => location.pathname })
    const breadcrumbs = getBreadcrumbs(pathname)
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
    return (
        <div className="min-h-dvh">
            <a href="#main-content" className="coeer-skip">跳到主要内容</a>
            <Sidebar user={user} open={open} onClose={closeNav} onSearch={() => setSearchOpen(true)} />
            <div className="coeer-shell-body flex min-h-dvh min-w-0 flex-col lg:pl-[var(--sidebar-width)]">
                <header className="coeer-topbar coeer-surface-chrome sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-border px-[var(--workspace-gutter)]">
                    <button type="button" aria-label="打开导航" aria-expanded={open} onClick={() => setOpen(true)} className="coeer-focus -ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted lg:hidden"><Icon name="panel" /></button>
                    <nav aria-label="当前位置" className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs">
                        {breadcrumbs.map((item, index) => <React.Fragment key={item.to + index}>
                            {index > 0 ? <Icon name="chevron" className="h-3 w-3 shrink-0 text-muted-foreground" /> : null}
                            {index === breadcrumbs.length - 1 ?
                                <span aria-current="page" className="truncate font-medium">{item.label}</span> :
                                <Link to={item.to as any} className="coeer-focus shrink-0 rounded py-2 text-muted-foreground hover:text-foreground">{item.label}</Link>}
                        </React.Fragment>)}
                    </nav>
                    <NotificationBell userId={user.id} />
                    <button type="button" data-command-trigger aria-label="搜索页面" onClick={() => { setOpen(false); setSearchOpen(true) }} className="coeer-focus grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"><Icon name="search" /></button>
                    <Link to="/profile" aria-label="个人中心" className="coeer-focus grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-medium text-primary lg:hidden"><Avatar src={user?.avatarUrl} name={user?.name || user?.email} className="h-8 w-8 text-xs" /></Link>
                </header>
                <BulletinNotices userId={user.id} />
                <main id="main-content" tabIndex={-1} className="coeer-workspace min-w-0 flex-1">{children}</main>
            </div>
            <CommandMenu user={user} open={searchOpen} onClose={closeSearch} />
        </div>
    )
}
