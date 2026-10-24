import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { SessionUser } from '../lib/types'
import { Icon } from '../ui/Icon'
import { navItems, adminNavItem } from './navItems'
import { useDialog } from '../hooks/useDialog'

export function CommandMenu({ open, onClose, user }: { open: boolean; onClose: () => void; user: SessionUser }) {
    const dialog = useDialog(open, '[data-command-trigger]')
    const input = React.useRef<HTMLInputElement>(null)
    const resultsRef = React.useRef<HTMLDivElement>(null)
    const [query, setQuery] = React.useState('')
    const [selected, setSelected] = React.useState(0)
    const navigate = useNavigate()
    const commands = [...navItems,
        { to: '/feedbacks/create', label: '提交反馈', icon: 'plus' as const },
        { to: '/profile', label: '个人中心', icon: 'user' as const },
        ...(user?.role === 'admin' ? [adminNavItem] : []),
    ]
    const filtered = commands.filter((item) => (item.label + item.to).toLowerCase().includes(query.trim().toLowerCase()))
    const active = Math.min(selected, Math.max(0, filtered.length - 1))
    React.useEffect(() => {
        if (open) {
            setQuery('')
            setSelected(0)
            input.current?.focus()
        }
    }, [open])
    React.useEffect(() => { resultsRef.current?.children[active]?.scrollIntoView({ block: 'nearest' }) }, [active])
    const choose = (to: string) => { onClose(); void navigate({ to: to as any }) }
    return (
        <dialog ref={dialog} className="coeer-command coeer-surface-floating" aria-label="搜索页面" onCancel={onClose} onClose={onClose}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
            }}>
            <div className="flex items-center gap-3 border-b border-border px-4">
                <Icon name="search" className="h-4 w-4 text-muted-foreground" />
                <input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0) }}
                    role="combobox" aria-expanded={open} aria-controls="coeer-page-results"
                    aria-autocomplete="list" aria-activedescendant={filtered.length ? 'coeer-command-' + active : undefined}
                    aria-label="搜索页面名称" placeholder="跳转到页面…" className="coeer-field h-14 min-w-0 flex-1 bg-transparent text-sm outline-none"
                    onKeyDown={(event) => {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            event.preventDefault()
                            if (filtered.length) setSelected((active + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length)
                        }
                        if (event.key === 'Enter' && filtered[active]) { event.preventDefault(); choose(filtered[active].to) }
                    }} />
                <button type="button" onClick={onClose} aria-label="关闭搜索" className="coeer-focus coeer-icon-button coeer-dialog-close text-muted-foreground hover:bg-muted"><Icon name="x" /></button>
            </div>
            <div id="coeer-page-results" role="listbox" aria-label="页面" ref={resultsRef} className="coeer-scrollbar max-h-[45dvh] overflow-y-auto p-2">
                {filtered.map((item, index) => (
                    <button key={item.to} id={'coeer-command-' + index} role="option" aria-selected={index === active} type="button" onClick={() => choose(item.to)}
                        className={'coeer-focus flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-[13px] ' + (index === active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted')}>
                        <Icon name={item.icon} /><span>{item.label}</span>{index === active ? <span className="ml-auto text-xs text-muted-foreground">Enter</span> : null}
                    </button>
                ))}
                {!filtered.length ? <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">未找到页面，试试“反馈”或“活动”。</p> : null}
            </div>
            <div className="flex gap-4 border-t border-border px-4 py-2.5 text-xs text-muted-foreground"><span>方向键选择</span><span>Enter 打开</span><span className="ml-auto">Esc 关闭</span></div>
        </dialog>
    )
}
