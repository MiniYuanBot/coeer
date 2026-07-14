import { Link } from '@tanstack/react-router'
import type { SessionUser } from '../lib/types'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { SearchInput } from '../ui/SearchInput'
import { navItems } from './navItems'

export function MobileNav({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: SessionUser }) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 animate-in fade-in duration-150 lg:hidden">
            <button className="absolute inset-0 bg-[hsl(var(--background)/0.72)] backdrop-blur-sm" aria-label="关闭导航" onClick={() => onOpenChange(false)} />
            <aside className="absolute right-0 top-0 h-full w-80 max-w-[86vw] animate-in slide-in-from-right-4 duration-200 border-l border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 shadow-2xl">
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
                            to={item.to as any}
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
