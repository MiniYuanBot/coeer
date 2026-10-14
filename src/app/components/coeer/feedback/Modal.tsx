import * as React from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

export function Modal({ open, title, children, onOpenChange }: {
    open: boolean
    title: string
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
}) {
    const ref = React.useRef<HTMLDialogElement>(null)
    const titleId = React.useId()
    React.useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        if (open && !dialog.open) dialog.showModal()
        if (!open && dialog.open) dialog.close()
        if (!open) return
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = previous }
    }, [open])
    return (
        <dialog ref={ref} aria-labelledby={titleId} onCancel={() => onOpenChange(false)}
            onClose={() => { if (open) onOpenChange(false) }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
                    onOpenChange(false)
                }
            }}
            className="fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-base font-semibold">{title}</h2>
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="关闭弹窗"><Icon name="x" /></Button>
            </div>
            {open ? <div className="mt-4">{children}</div> : null}
        </dialog>
    )
}
