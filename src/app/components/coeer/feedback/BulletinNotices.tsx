import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getBulletinFeedFn } from '~/functions/bulletins'
import { Modal } from './Modal'
import { Markdown } from '../ui/Markdown'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import type { BulletinWithSource } from '@shared/contracts'

function BulletinBanner({ item, onDismiss }: { item: BulletinWithSource; onDismiss: () => void }) {
    return <aside aria-label="公告通知" className="coeer-bulletin-banner flex min-w-0 items-center gap-3 border-b border-border bg-primary-soft px-4 py-2 text-sm sm:px-5">
        <Icon name="bell" className="h-4 w-4 shrink-0 text-primary" />
        <Link to="/bulletins/$bulletinId" params={{ bulletinId: item.id }} aria-label={item.title}
            className="coeer-focus coeer-bulletin-viewport min-w-0 flex-1 overflow-hidden rounded font-medium text-primary">
            <span aria-hidden="true" className="coeer-bulletin-track" style={{ animationDuration: `${Math.max(20, item.title.length * 0.4)}s` }}>
                <span className="coeer-bulletin-copy">{item.title}</span>
                <span className="coeer-bulletin-copy">{item.title}</span>
            </span>
        </Link>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onDismiss} aria-label={`关闭公告：${item.title}`}>关闭</Button>
    </aside>
}

export function BulletinNotices({ userId }: { userId: string }) {
    const [dismissed, setDismissed] = useState<string[]>([])
    const [ready, setReady] = useState(false)
    const key = `bulletin-notices:${userId}`
    useEffect(() => {
        try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); setDismissed(Array.isArray(saved) ? saved : []) } catch { setDismissed([]) }
        setReady(true)
    }, [key])
    const { data } = useQuery({
        queryKey: ['bulletin-notices', userId], queryFn: async () => {
            const pages = await Promise.all((['modal', 'banner'] as const).map(async notificationMode => {
                const items: BulletinWithSource[] = []
                for (let offset = 0; ; offset += 100) {
                    const result = await getBulletinFeedFn({ data: { notificationMode, limit: 100, offset } })
                    if (!result.success || !result.data) throw new Error('公告加载失败')
                    items.push(...(result.data.items ?? []))
                    if (items.length >= (result.data.total ?? 0) || !result.data.items?.length) break
                }
                return items
            }))
            return pages.flat()
        }, refetchInterval: 60_000, staleTime: 30_000
    })
    const version = (item: BulletinWithSource) => `${item.id}:${new Date(item.updatedAt).toISOString()}:${item.notificationMode}`
    const visible = ready ? (data ?? []).filter(item => !dismissed.includes(version(item))) : []
    function dismiss(item: BulletinWithSource) {
        const next = [...dismissed, version(item)].slice(-500)
        setDismissed(next)
        try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* In-memory dismissal still works. */ }
    }
    const modal = visible.find(item => item.notificationMode === 'modal')
    return <>
        {visible.filter(item => item.notificationMode === 'banner').map(item => <BulletinBanner key={version(item)} item={item} onDismiss={() => dismiss(item)} />)}
        <Modal open={!!modal} title={modal?.title ?? '公告'} onOpenChange={open => { if (!open && modal) dismiss(modal) }}>
            {modal && <><Markdown content={modal.content} /><Button className="mt-4" onClick={() => dismiss(modal)}>我知道了</Button></>}
        </Modal>
    </>
}
