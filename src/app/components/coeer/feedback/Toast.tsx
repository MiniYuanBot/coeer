import * as React from 'react'
import type { BadgeTone } from '../lib/types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

type Toast = { id: number; title: string; description?: string; tone?: BadgeTone }
const ToastContext = React.createContext<{ toast: (toast: Omit<Toast, 'id'>) => void } | null>(null)

const toastToneLabels: Record<BadgeTone, string> = {
    default: '通知',
    primary: '提示',
    success: '成功',
    warning: '注意',
    danger: '错误',
    muted: '通知',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const toast = React.useCallback((item: Omit<Toast, 'id'>) => {
        setToasts((prev) => {
            const id = prev.length ? prev[prev.length - 1].id + 1 : 1
            window.setTimeout(() => setToasts((cur) => cur.filter((toast) => toast.id !== id)), 3200)
            return [...prev, { ...item, id }]
        })
    }, [])

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[70] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
                {toasts.map((item) => (
                    <Card key={item.id} className="p-4">
                        <div className="flex items-start gap-3">
                            {item.tone ? <Badge tone={item.tone}>{toastToneLabels[item.tone]}</Badge> : null}
                            <div>
                                <div className="font-medium">{item.title}</div>
                                {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = React.useContext(ToastContext)
    if (!ctx) return { toast: () => undefined }
    return ctx
}
