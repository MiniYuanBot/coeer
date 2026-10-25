import { useSyncExternalStore, type AnchorHTMLAttributes } from 'react'

function currentPath() {
    return window.location.hash.slice(1) || `/admin/${new URLSearchParams(window.location.search).get('kind')}`
}
function subscribe(callback: () => void) {
    window.addEventListener('hashchange', callback)
    window.addEventListener('fixture-navigation', callback)
    return () => {
        window.removeEventListener('hashchange', callback)
        window.removeEventListener('fixture-navigation', callback)
    }
}
export function useFixturePath() { return useSyncExternalStore(subscribe, currentPath) }
type Destination = { to: string; params?: Record<string, string>; search?: Record<string, unknown> }
function destination({ to, params, search }: Destination) {
    for (const [name, value] of Object.entries(params ?? {})) to = to.replace(`$${name}`, value)
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(search ?? {})) if (value !== undefined) query.set(key, String(value))
    return to + (query.size ? `?${query}` : '')
}
export function fixtureSearch() {
    const query = new URLSearchParams(window.location.hash.split('?')[1] || '')
    return { ...Object.fromEntries(query), page: Number(query.get('page')) || 1 }
}
export function useNavigate() {
    return async (target: Destination) => {
        window.location.hash = destination(target)
        window.dispatchEvent(new Event('fixture-navigation'))
    }
}
export function useRouter() { return { invalidate: async () => {} } }
export function Link({ to, params, search, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & Destination) {
    const navigate = useNavigate()
    return <a {...props} href={`#${destination({ to, params, search })}`} onClick={event => {
        event.preventDefault()
        void navigate({ to, params, search })
    }} />
}
