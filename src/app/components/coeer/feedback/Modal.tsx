import * as React from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function Modal({
    open,
    title,
    children,
    onOpenChange,
}: {
    open: boolean
    title: string
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
}) {
    if (!open) return null
    return (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4">
            <button className="absolute inset-0 bg-slate-950/40" aria-label="关闭弹窗" onClick={() => onOpenChange(false)} />
            <Card className="relative w-full max-w-lg p-5">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        <Icon name="x" />
                    </Button>
                </div>
                <div className="mt-4">{children}</div>
            </Card>
        </div>
    )
}
