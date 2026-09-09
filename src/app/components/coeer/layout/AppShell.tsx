import { Link } from '@tanstack/react-router'
import * as React from 'react'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { Sidebar } from './Sidebar'

/**
 * Authenticated application shell (dub-style):
 * - desktop: fixed left sidebar + scrollable content column
 * - mobile: slim top bar (brand + menu) that opens the same sidebar as a drawer
 */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)

    // Lock body scroll while the mobile drawer is open
    React.useEffect(() => {
        if (!open) return
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [open])

    return (
        <div className="min-h-dvh bg-background">
            <Sidebar user={user} open={open} onClose={() => setOpen(false)} />

            <div className="flex min-h-dvh flex-col lg:pl-64">
                {/* Mobile top bar */}
                <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur lg:hidden">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-black text-primary-foreground">
                            C
                        </span>
                        <span className="text-sm font-bold tracking-tight">COEER</span>
                    </Link>
                    <div className="ml-auto flex items-center gap-1">
                        <Link
                            to={user ? '/profile' : '/login'}
                            aria-label="个人中心"
                            className="coeer-focus grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <Icon name="user" className="h-5 w-5" />
                        </Link>
                        <button
                            type="button"
                            aria-label="打开导航"
                            onClick={() => setOpen(true)}
                            className="coeer-focus grid h-9 w-9 place-items-center rounded-lg text-foreground hover:bg-muted"
                        >
                            <Icon name="menu" className="h-5 w-5" />
                        </button>
                    </div>
                </header>

                <main className="coeer-container flex-1 py-6 md:py-8">{children}</main>
            </div>
        </div>
    )
}
