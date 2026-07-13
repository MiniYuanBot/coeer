import * as React from 'react'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'

export function Drawer({
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
        <div className="fixed inset-0 z-[60]">
            <button className="absolute inset-0 bg-slate-950/35" aria-label="关闭抽屉" onClick={() => onOpenChange(false)} />
            <Card className="absolute bottom-0 right-0 top-auto max-h-[88vh] w-full overflow-auto rounded-b-none p-5 md:right-4 md:top-4 md:h-[calc(100vh-2rem)] md:max-h-none md:w-[28rem] md:rounded-lg">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{title}</h2>
                    <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                        <Icon name="x" />
                    </Button>
                </div>
                <div className="mt-4">{children}</div>
            </Card>
        </div>
    )
}
