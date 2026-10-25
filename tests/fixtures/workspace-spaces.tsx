import type { ReactNode } from 'react'
import { booking, empty, space, state, user } from './workspace-data'
export class SpaceApiError extends Error { constructor(message: string, readonly bookingId?: string) { super(message) } }
export const spaceApi = async <T,>(): Promise<T> => { throw new Error('UI fixture: writes are disabled') }
export function useSpaces() { return { config: { horizon: 7, writesEnabled: true, demo: true }, user, loading: false, error: '', reload: () => {} } }
const slots = Array.from({ length: 12 }, (_, index) => ({ start: 540 + index * 30, end: 570 + index * 30, state: index % 4 === 0 ? 'unavailable' : index % 4 === 1 ? 'pending_approval' : 'available', kind: 'meeting', remaining: 12 }))
const availability = { slots, stale: false, observedAt: '2026-10-24T08:00:00Z' }
export function useSpaceResource<T>(path: string | null) {
    const data = path === '/admin/overview' ? {
        adapter: 'mock', bookings: [{ ...booking, status: 'pending_review' }],
        spaces: [{ ...space, published: true, bookable: true, policy: { kind: 'meeting', rulesSource: 'local' } }],
        scenarios: [], allowlist: [{ name: user.name, studentId: user.studentId, bookingPermission: 'review' }],
    } : path?.includes('availability') ? availability : path === '/spaces' ? (empty ? [] : [space]) : path === '/bookings' ? (empty ? [] : [booking]) : path?.startsWith('/bookings/') ? booking : space
    return { data: (state === 'loading' ? undefined : data) as T | undefined, loading: state === 'loading', error: state === 'error' ? '网络暂时中断，已保留上次加载的内容。' : '', reload: () => {} }
}
export function SpacesProvider({ children }: { children: ReactNode }) { return children }
