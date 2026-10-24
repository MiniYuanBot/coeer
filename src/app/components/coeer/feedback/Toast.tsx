import * as React from 'react'
import { createPortal } from 'react-dom'
import type { BadgeTone } from '../lib/types'
import { Badge } from '../ui/Badge'
import { Icon } from '../ui/Icon'

type Toast = { id: number; title: string; description?: string; tone?: BadgeTone }
const ToastContext = React.createContext<{ toast: (toast: Omit<Toast, 'id'>) => void } | null>(null)
const toneLabels: Record<BadgeTone, string> = { default: '通知', primary: '提示', success: '成功', warning: '注意', danger: '错误', muted: '通知' }

function ToastMessage({ item, dismiss }: { item: Toast; dismiss: (id: number) => void }) {
    const remaining = React.useRef(5000)
    const started = React.useRef(0)
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const hovered = React.useRef(false)
    const focused = React.useRef(false)
    const pause = React.useCallback(() => {
        if (!timer.current) return
        clearTimeout(timer.current)
        timer.current = undefined
        remaining.current = Math.max(0, remaining.current - (Date.now() - started.current))
    }, [])
    const resume = React.useCallback(() => {
        // Errors stay available until explicitly dismissed, including during a modal task.
        if (item.tone === 'danger' || hovered.current || focused.current || timer.current) return
        started.current = Date.now()
        timer.current = setTimeout(() => dismiss(item.id), remaining.current)
    }, [dismiss, item.id, item.tone])
    React.useEffect(() => { resume(); return pause }, [resume, pause])
    return <div className="coeer-toast" data-tone={item.tone}
        onMouseEnter={() => { hovered.current = true; pause() }} onMouseLeave={() => { hovered.current = false; resume() }}
        onFocusCapture={() => { focused.current = true; pause() }} onBlurCapture={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            focused.current = false; resume()
        }}>
        <div role={item.tone === 'danger' ? 'alert' : 'status'} aria-atomic="true" className="min-w-0 flex-1 space-y-2">
            {item.tone ? <Badge tone={item.tone}>{toneLabels[item.tone]}</Badge> : null}
            <p className="text-sm font-medium">{item.title}</p>
            {item.description ? <p className="text-[13px] leading-6 text-muted-foreground">{item.description}</p> : null}
        </div>
        <button type="button" className="coeer-focus coeer-icon-button text-muted-foreground hover:bg-muted" aria-label={`关闭通知：${item.title}`} onClick={() => dismiss(item.id)}><Icon name="x" /></button>
    </div>
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const [host, setHost] = React.useState<HTMLElement | null>(null)
    const sequence = React.useRef(0)
    const toast = React.useCallback((item: Omit<Toast, 'id'>) => {
        const id = ++sequence.current
        setToasts(previous => [...previous, { ...item, id }])
    }, [])
    const dismiss = React.useCallback((id: number) => setToasts(previous => previous.filter(item => item.id !== id)), [])
    React.useEffect(() => {
        const update = () => {
            const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog:modal')
            setHost(dialogs.item(dialogs.length - 1) || document.body)
        }
        update()
        const observer = new MutationObserver(update)
        observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
        return () => observer.disconnect()
    }, [])
    const modal = host?.tagName === 'DIALOG'
    return <ToastContext.Provider value={{ toast }}>
        {children}
        {host && toasts.length ? createPortal(
            <div aria-label="操作通知" className={modal ? 'coeer-dialog-notices' : 'coeer-toast-viewport coeer-surface-floating'}>
                {toasts.map(item => <ToastMessage key={item.id} item={item} dismiss={dismiss} />)}
            </div>, host,
        ) : null}
    </ToastContext.Provider>
}

export function useToast() {
    return React.useContext(ToastContext) ?? { toast: () => undefined }
}
