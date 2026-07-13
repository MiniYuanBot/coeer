import * as React from 'react'
import type { BadgeTone } from '../lib/types'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'

type Toast = { id: number; title: string; description?: string; tone?: BadgeTone }
const ToastContext = React.createContext<{ toast: (toast: Omit<Toast, 'id'>) => void } | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([])
    const toast = React.useCallback((item: Omit<Toast, 'id'>) => {
        const id = Date.now()
        setToasts((prev) => [...prev, { ...item, id }])
        window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3200)
    }, [])

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[70] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
                {toasts.map((item) => (
                    <Card key={item.id} className="p-4">
                        <div className="flex items-start gap-3">
                            <Badge tone={item.tone ?? 'primary'}>{item.tone ?? 'info'}</Badge>
                            <div>
                                <div className="font-medium">{item.title}</div>
                                {item.description ? <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{item.description}</p> : null}
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
