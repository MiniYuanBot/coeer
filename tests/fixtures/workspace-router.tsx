import type { ComponentType, ReactNode } from 'react'
import { loaderData, pathname, screen, user } from './workspace-data'

export const navigations: unknown[] = []
export function useNavigate() { return async (value: unknown) => { navigations.push(value); window.dispatchEvent(new Event('ui-navigation')) } }
export function useRouter() { return { invalidate: async () => {}, navigate: useNavigate() } }
export function useHydrated() { return true }
export function useRouteContext() { return { user } }
export function useLocation({ select }: any) { return select ? select({ pathname }) : { pathname } }
export function useRouterState({ select }: any) { const value = { status: 'idle', location: { pathname } }; return select ? select(value) : value }
export function createFileRoute(route: string) {
    return (options: { component?: ComponentType; [key: string]: any }) => ({
        options, useLoaderData: () => loaderData(route), useRouteContext: () => ({ user }),
        useParams: () => ({ spaceId: 'ui-space', bookingId: 'ui-booking', feedbackId: 'ui-feedback-0', slug: 'campus' }),
        useNavigate, useSearch: () => ({ page: 1, q: '', module: 'all', capacity: 0, view: screen === 'groups' ? 'public' : 'public', date: '2099-10-25' }),
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
