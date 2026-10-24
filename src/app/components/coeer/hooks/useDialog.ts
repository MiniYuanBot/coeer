import * as React from 'react'

let scrollLocks = 0
let previousOverflow = ''

/** Native modal focus containment plus a shared, nesting-safe scroll lock. */
export function useDialog(open: boolean, returnFocusSelector?: string) {
    const ref = React.useRef<HTMLDialogElement>(null)
    React.useEffect(() => {
        const dialog = ref.current
        if (!dialog || !open) return
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (!dialog.open) dialog.showModal()
        if (scrollLocks++ === 0) {
            previousOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
        }
        return () => {
            if (dialog.open) dialog.close()
            if (--scrollLocks === 0) document.body.style.overflow = previousOverflow
            // A search launched from the drawer must return to a visible page trigger.
            const visibleTrigger = Array.from(document.querySelectorAll<HTMLElement>(returnFocusSelector ?? '[data-command-trigger]')).find(element => element.getClientRects().length)
            const target = returnFocusSelector ? visibleTrigger : trigger?.isConnected && trigger.getClientRects().length ? trigger : visibleTrigger
            target?.focus({ preventScroll: true })
        }
    }, [open, returnFocusSelector])
    return ref
}
