// server-only helper: “can this user interact with / read this target?”
import { feedbackQueries, groupMemberQueries, groupPostQueries } from '../database/queries'
import { groupQueries } from '../database/queries/groups'
import { GROUP_MEMBER_STATUS, GROUP_STATUS } from '@shared/constants'

export type TargetRef = { targetType: 'group_post' | 'feedback'; targetId: string }
export type Viewer = { id: string; role: string } | undefined

/** Discussions belong to the group: public post visibility alone grants no reply access. */
export async function getDiscussionAccess(data: TargetRef, user: Viewer) {
    const denied = { canRead: false, canReply: false, canManage: false }
    if (!user || data.targetType !== 'group_post') return denied
    const post = await groupPostQueries.findById({ id: data.targetId })
    if (!post) return denied
    const group = await groupQueries.findById({ groupId: post.groupId })
    if (!group) return denied
    const membership = await groupMemberQueries.findByGroupAndUser({ groupId: group.id, userId: user.id })
    const member = membership?.status === GROUP_MEMBER_STATUS.APPROVED
    return {
        canRead: member || user.role === 'admin',
        canReply: member && group.status === GROUP_STATUS.APPROVED,
        canManage: member && (membership.role === 'admin' || membership.role === 'owner'),
    }
}

/**
 * Checks whether `user` may act on the given content target:
 * - group posts → visible when the group is approved+public, or the user is
 *   an approved member / platform admin (mirrors GroupPostService).
 * - feedbacks → visible when public, or the user is the author / admin.
 *
 * Returns false when the target is missing OR not visible (callers can map
 * both to TARGET_NOT_FOUND / FORBIDDEN without leaking existence).
 */
export async function canViewTarget(data: TargetRef, user: Viewer): Promise<boolean> {
    if (data.targetType === 'group_post') {
        const post = await groupPostQueries.findById({ id: data.targetId })
        if (!post) return false
        const group = await groupQueries.findById({ groupId: post.groupId })
        if (!group) return false

        if (group.status === GROUP_STATUS.APPROVED && group.isPublic) return true
        if (!user) return false
        if (user.role === 'admin') return true

        const membership = await groupMemberQueries.findByGroupAndUser({ groupId: group.id, userId: user.id })
        return !!membership && membership.status === GROUP_MEMBER_STATUS.APPROVED
    }

    // feedback
    const feedback = await feedbackQueries.findById({ id: data.targetId })
    if (!feedback) return false
    if (feedback.isPublic) return true
    if (!user) return false
    if (user.role === 'admin') return true
    return feedback.authorId === user.id
}
