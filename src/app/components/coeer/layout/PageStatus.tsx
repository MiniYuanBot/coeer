import { useHydrated, useRouterState } from '@tanstack/react-router'

export function PageStatus() {
    const status = useRouterState({ select: (state) => state.status })
    const hydrated = useHydrated()
    if (!hydrated || status !== 'pending') return null
    return <div role="progressbar" aria-label="正在加载页面" className="fixed left-0 right-0 top-0 z-[80] h-0.5 animate-pulse bg-primary" />
}
