import * as React from 'react'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { useDialog } from '../hooks/useDialog'

export function Modal({ open, title, children, onOpenChange }: {
    open: boolean
    title: string
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
}) {
    const ref = useDialog(open)
    const titleId = React.useId()
    return (
        <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onOpenChange(false) }}
            onClose={() => { if (open) onOpenChange(false) }}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
                    onOpenChange(false)
                }
            }}
            className="coeer-modal coeer-surface-floating">
            <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-base font-semibold">{title}</h2>
                <Button variant="ghost" size="icon" className="coeer-dialog-close" onClick={() => onOpenChange(false)} aria-label="关闭弹窗"><Icon name="x" /></Button>
            </div>
            {open ? <div className="coeer-modal-content mt-4">{children}</div> : null}
        </dialog>
    )
}
