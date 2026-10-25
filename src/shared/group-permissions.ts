import type { GroupMemberRole, GroupMemberStatus } from './constants/groupMembers'

export type Membership = { id: string; userId: string; role: GroupMemberRole; status: GroupMemberStatus }
export const isGroupManager = (role?: string) => role === 'owner' || role === 'admin'

/** Evaluated again under the group row lock before every roster mutation. */
export function membershipChangeError(actor: Membership | undefined, target: Membership, roster: Membership[],
    change: { remove: true; selfLeave?: boolean } | { update: { role?: GroupMemberRole; status?: GroupMemberStatus } },
): 'FORBIDDEN' | 'OWNER_PROTECTED' | 'ADMIN_LIMIT' | 'INVALID_STATUS' | undefined {
    const leaving = 'remove' in change && change.selfLeave && actor?.userId === target.userId
    if (!leaving && (!actor || actor.status !== 'approved' || !isGroupManager(actor.role))) return 'FORBIDDEN'
    if (target.role === 'owner') return 'OWNER_PROTECTED'
    if ('remove' in change) return
    const { role, status } = change.update
    if (status && (target.status !== 'pending' || status === 'pending')) return 'INVALID_STATUS'
    if (role !== undefined) {
        if (actor?.role !== 'owner') return 'FORBIDDEN'
        if (target.status !== 'approved' || status) return 'INVALID_STATUS'
        if (role === 'admin' && target.role !== 'admin' && roster.filter(m => m.role === 'admin').length >= 3) return 'ADMIN_LIMIT'
    }
}
