import { useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { group, loaderData, pathname, screen, user } from './workspace-data'

export const navigations: unknown[] = []
let adminSearch: any = { scope: 'reviewed', page: 1 }
let revision = 0
const subscribe = (notify: () => void) => { window.addEventListener('ui-navigation', notify); return () => window.removeEventListener('ui-navigation', notify) }
const useRevision = () => useSyncExternalStore(subscribe, () => revision)
const refresh = () => { revision++; window.dispatchEvent(new Event('ui-navigation')) }

export function useNavigate() { return async (value: unknown) => { navigations.push(value); if ((screen === 'admin' || screen === 'adminGroups') && (value as any).search) { const search = (value as any).search; adminSearch = typeof search === 'function' ? search(adminSearch) : search }; refresh() } }
export function useRouter() { return { invalidate: async () => { refresh() }, navigate: useNavigate() } }
export function useHydrated() { return true }
export function useRouteContext() { return { user } }
export function useLocation({ select }: any) { return select ? select({ pathname }) : { pathname } }
export function useRouterState({ select }: any) { const value = { status: 'idle', location: { pathname } }; return select ? select(value) : value }
export function createFileRoute(route: string) {
    return (options: { component?: ComponentType; [key: string]: any }) => ({
        options, useLoaderData: () => {
            useRevision()
            const data = loaderData(route)
            if ((screen === 'admin' || screen === 'adminGroups') && route.includes('/admin/feedbacks')) {
                const feedbacks = data.feedbacks.filter((row: any) => (adminSearch.scope === 'pending' ? row.status === 'pending' : row.status !== 'pending') && (!adminSearch.status || row.status === adminSearch.status))
                return { ...data, feedbacks, total: feedbacks.length }
            }
            if (screen === 'adminGroups' && route.includes('/admin/groups')) {
                const groups = data.groups.filter((row: any) => (adminSearch.scope === 'pending' ? row.status === 'pending' : row.status !== 'pending') && (!adminSearch.reviewStatus || row.status === adminSearch.reviewStatus))
                return { ...data, groups, total: groups.length }
            }
            return data
        }, useRouteContext: () => ({ user, group, isPending: screen === 'groupPending', isMember: screen === 'groupMember', isAdmin: false }),
        useParams: () => ({ spaceId: 'ui-space', bookingId: 'ui-booking', feedbackId: 'ui-feedback-0', slug: 'campus' }),
        useNavigate, useSearch: () => { useRevision(); return (screen === 'admin' || screen === 'adminGroups') ? adminSearch : ({ scope: 'all', status: 'all', page: 1, q: '', module: 'all', capacity: 0, view: screen === 'groups' ? 'public' : 'public', date: '2099-10-25' }) },
    })
}
export function redirect(value: unknown) { return value }
export function Outlet() { return null }
export function Link({ to, params, search, activeOptions, activeProps, children, ...props }: any) {
    let href = to ?? '#'
    for (const [key, value] of Object.entries(params ?? {})) href = href.replace('$' + key, value)
    const active = activeOptions?.exact ? pathname === href : pathname.startsWith(href) && href !== '/'
    return <a {...props} href={href} data-status={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}
        onClick={(event) => { event.preventDefault(); props.onClick?.(event); navigations.push({ to, params, search }); window.dispatchEvent(new Event('ui-navigation')) }}>{children as ReactNode}</a>
}
