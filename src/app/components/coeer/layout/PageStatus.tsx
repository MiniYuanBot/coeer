import { useRouterState } from '@tanstack/react-router'

export function PageStatus() {
    const status = useRouterState({ select: (state) => state.status })
    if (status !== 'pending') return null
    return <div className="fixed left-0 right-0 top-0 z-[80] h-0.5 animate-pulse bg-[hsl(var(--primary))]" />
}
