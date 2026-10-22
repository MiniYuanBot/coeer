// services/GroupService.ts
import { db } from '../database/client'
import { Group, GroupMember, groups, groupMembers } from '../database/schemas'
import { eq } from 'drizzle-orm'
import { NotificationService } from './NotificationService'
import type {
    CreateGroupInput,
    GroupWithStats,
    GroupResponse,
    PaginatedGroupResponse,
    GroupMemberResponse,
    PaginatedGroupMemberResponse,
    GroupMemberWithGroup,
    GroupMemberWithUser,
    GroupWithCreator,
    GroupIdInput,
    GroupSlugWithFilterInput,
    ListMyGroupsInput,
    UpdateGroupInput,
    UpdateGroupStatusInput,
    ListAllGroupsInput,
    ApproveGroupInput,
    CheckRoleInput,
    ListMembersByGroupInput,
    UpdateGroupMemberInput,
    GroupMemberIdInput,
} from '@shared/contracts'
import {
    GROUP_STATUS,
    GROUP_MEMBER_ROLE,
    GROUP_MEMBER_STATUS,
    GROUP,
    GROUP_MEMBER,
} from '@shared/constants'
import { AuthService } from './AuthService'
import { groupQueries } from '../database/queries/groups'
import { groupMemberQueries } from '../database/queries'

export class GroupService {
    /** Serialize roster changes per group, then recheck the actor and last admin. */
    private static async changeMembership(memberId: string, actorId: string,
        change: { remove: true; selfLeave?: boolean } | { update: UpdateGroupMemberInput },
    ): Promise<GroupMemberResponse<void>> {
        const target = await groupMemberQueries.findById({ memberId })
        if (!target) return { success: false, state: GROUP_MEMBER.NOT_FOUND }
        return db.transaction(async (tx) => {
            const [group] = await tx.select().from(groups).where(eq(groups.id, target.groupId)).for('update')
            if (!group) return { success: false, state: GROUP_MEMBER.GROUP_NOT_FOUND }
            const roster = await tx.select().from(groupMembers).where(eq(groupMembers.groupId, group.id))
            const member = roster.find((item) => item.id === memberId)
            if (!member) return { success: false, state: GROUP_MEMBER.NOT_FOUND }
            const actor = roster.find((item) => item.userId === actorId)
            const leaving = 'remove' in change && change.selfLeave && member.userId === actorId
            if (!leaving && (actor?.role !== 'admin' || actor.status !== 'approved')) return { success: false, state: GROUP_MEMBER.FORBIDDEN }
            const update = 'update' in change ? change.update : undefined
            if (update?.status && (member.status !== 'pending' || update.status === 'pending')) return { success: false, state: GROUP_MEMBER.INVALID_STATUS }
            const losesAdmin = member.role === 'admin' && member.status === 'approved' &&
                ('remove' in change || (update?.role !== undefined && update.role !== 'admin'))
            if (losesAdmin && roster.filter((item) => item.role === 'admin' && item.status === 'approved').length <= 1) {
                return { success: false, state: GROUP_MEMBER.LAST_ADMIN }
            }
            if ('remove' in change) {
                await tx.delete(groupMembers).where(eq(groupMembers.id, memberId))
                return { success: true, state: leaving ? GROUP_MEMBER.LEAVE_SUCCESS : GROUP_MEMBER.DELETE_SUCCESS }
            }
            await tx.update(groupMembers).set({ role: update!.role, status: update!.status, updatedAt: new Date() }).where(eq(groupMembers.id, memberId))
            if (update!.status && update!.status !== member.status) {
                await NotificationService.create({ userId: member.userId, type: 'membership_review', title: '入群申请审核结果',
                    content: `你加入「${group.name}」的申请${update!.status === 'approved' ? '已通过' : '未通过'}。`,
                    href: update!.status === 'approved' ? `/groups/${group.slug}` : '/groups',
                }, tx)
            }
            return { success: true, state: GROUP_MEMBER.UPDATE_SUCCESS }
        })
    }
    // Create a group
    static async create(data: CreateGroupInput): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if slug is already taken
            const existingGroup = await groupQueries.findBySlug(data)
            if (existingGroup) {
                return {
                    success: false,
                    state: GROUP.ALREADY_EXISTS,
                }
            }

            const result = await db.transaction(async (tx) => {
                // Create the group
                const [group] = await tx.insert(groups).values({
                    ...data,
                    creatorId: user.id,
                    status: GROUP_STATUS.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }).returning()

                // Add creator as admin
                await tx.insert(groupMembers).values({
                    groupId: group.id,
                    userId: user.id,
                    role: GROUP_MEMBER_ROLE.ADMIN,
                    status: GROUP_MEMBER_STATUS.APPROVED,
                    joinedAt: new Date(),
                    updatedAt: new Date()
                })

                return group
            })

            return {
                success: true,
                data: result,
                state: GROUP.CREATE_SUCCESS,
            }
        } catch (err) {
            console.error('Create group error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // Update group info (admin only)
    static async update(data: UpdateGroupInput): Promise<GroupResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if user is admin
            const isAdmin = await groupMemberQueries.checkRole({
                groupId: data.id,
                userId: user.id,
                role: 'admin'
            })
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP.FORBIDDEN,
                }
            }

            await groupQueries.update({
                ...data,
                updatedAt: new Date()
            })

            return {
                success: true,
                state: GROUP.UPDATE_SUCCESS,
            }
        } catch (err) {
            console.error('Update group error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // Delete a group
    static async delete(data: GroupIdInput): Promise<GroupResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP.NOT_FOUND,
                }
            }

            // Creation history does not retain management rights after a role change.
            {
                const isAdmin = await groupMemberQueries.checkRole({
                    groupId: data.groupId,
                    userId: user.id,
                    role: 'admin'
                })
                if (!isAdmin) {
                    return {
                        success: false,
                        state: {
                            ...GROUP.FORBIDDEN,
                            message: 'Only admin can delete the group'
                        },
                    }
                }
            }

            await groupQueries.delete(data)

            return {
                success: true,
                state: GROUP.DELETE_SUCCESS,
            }
        } catch (err) {
            console.error('Delete group error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // Get group with stats by slug
    static async getBySlug(data: GroupSlugWithFilterInput): Promise<GroupResponse<GroupWithStats>> {
        try {
            const group = await groupQueries.findBySlug(data)

            if (!group) {
                return {
                    success: false,
                    state: GROUP.NOT_FOUND,
                }
            }

            // Hide not-yet-approved groups from everyone except their members
            // and platform admins (a pending group must not be discoverable).
            if (group.status !== GROUP_STATUS.APPROVED) {
                const payload = await AuthService.getCurrentUser()
                const user = payload.data
                const isPlatformAdmin = payload.success && !!user && user.role === 'admin'

                let canView = isPlatformAdmin
                if (!canView && user?.id) {
                    const membership = await groupMemberQueries.findByGroupAndUser({
                        groupId: group.id,
                        userId: user.id,
                    })
                    canView = !!membership && membership.status === GROUP_MEMBER_STATUS.APPROVED
                }

                if (!canView) {
                    return { success: false, state: GROUP.NOT_FOUND }
                }
            }

            return {
                success: true,
                data: group,
                state: GROUP.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get group by slug error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // List public approved groups
    static async listAllGroups(data: ListAllGroupsInput): Promise<PaginatedGroupResponse<GroupWithCreator>> {
        try {
            const { status, category, search, limit, offset } = data

            const groups = await groupQueries.listAll(data)

            const total = await groupQueries.countGroups({
                status,
                category,
                search
            })

            return {
                success: true,
                data: {
                    items: groups,
                    total,
                    limit,
                    offset
                },
                state: GROUP.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List public groups error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // List groups I've joined
    static async listMyGroups(data: ListMyGroupsInput): Promise<PaginatedGroupMemberResponse<GroupMemberWithGroup>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const { status, role, limit, offset } = data

            const memberships = await groupMemberQueries.listByUser({
                userId: user.id,
                ...data
            })

            const total = await groupMemberQueries.countByUser({ userId: user.id, status, role })

            return {
                success: true,
                data: {
                    items: memberships,
                    total,
                    limit,
                    offset
                },
                state: GROUP_MEMBER.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List my groups error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }

    // Platform admin review for pending groups.
    // NOTE: this must check the *platform* role. Previously it checked group
    // membership, which let a creator (auto-inserted as group admin) approve
    // their own group — a moderation bypass.
    static async approveGroup(data: ApproveGroupInput): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            if (user.role !== 'admin') {
                return { success: false, state: GROUP.FORBIDDEN }
            }

            const group = await groupQueries.findById({ groupId: data.id })
            if (!group) {
                return {
                    success: false,
                    state: GROUP.NOT_FOUND,
                }
            }

            if (group.status !== GROUP_STATUS.PENDING) {
                return {
                    success: false,
                    state: { ...GROUP.INVALID_STATUS, message: 'Group is already reviewed' }
                }
            }

            const status = data.approved ? GROUP_STATUS.APPROVED : GROUP_STATUS.REJECTED
            const reviewed = await db.transaction(async (tx) => {
                const [current] = await tx.select().from(groups).where(eq(groups.id, data.id)).for('update')
                if (!current || current.status !== GROUP_STATUS.PENDING) return false
                await tx.update(groups).set({ status, rejectedReason: data.rejectedReason, updatedAt: new Date() }).where(eq(groups.id, data.id))
                if (group.creatorId) await NotificationService.create({
                    userId: group.creatorId, type: 'group_review', title: '群组审核结果',
                    content: `你创建的群组「${group.name}」${data.approved ? '已通过审核' : '未通过审核'}。${data.rejectedReason ?? ''}`,
                    href: data.approved ? `/groups/${group.slug}` : '/groups?view=managed',
                }, tx)
                return true
            })
            if (!reviewed) return { success: false, state: GROUP.INVALID_STATUS }

            if (status === GROUP_STATUS.APPROVED) {
                return {
                    success: true,
                    state: GROUP.APPROVE_SUCCESS,
                }
            } else {
                return {
                    success: true,
                    state: GROUP.REJECT_SUCCESS,
                }
            }
        } catch (err) {
            console.error('Approve group error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // Platform admin review for management dashboard.
    static async updateGroupStatus(data: UpdateGroupStatusInput): Promise<GroupResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }
            if (user.role !== 'admin') {
                return { success: false, state: GROUP.FORBIDDEN }
            }

            const group = await groupQueries.findById({ groupId: data.id })
            if (!group) {
                return { success: false, state: GROUP.NOT_FOUND }
            }

            await db.transaction(async (tx) => {
                const [current] = await tx.select().from(groups).where(eq(groups.id, data.id)).for('update')
                if (!current) throw new Error('Group not found')
                await tx.update(groups).set({
                    status: data.status,
                    rejectedReason: data.status === GROUP_STATUS.REJECTED ? data.rejectedReason : null,
                    reviewNote: data.reviewNote,
                    updatedAt: new Date(),
                }).where(eq(groups.id, data.id))
                if (current.creatorId && current.status !== data.status) {
                    const labels = { pending: '已进入待审核状态', approved: '已通过审核', rejected: '未通过审核' }
                    await NotificationService.create({
                        userId: current.creatorId, type: 'group_review', title: '群组审核结果',
                        content: `你创建的群组「${current.name}」${labels[data.status]}。${data.rejectedReason ?? data.reviewNote ?? ''}`,
                        href: data.status === GROUP_STATUS.APPROVED ? `/groups/${current.slug}` : '/groups?view=joined',
                    }, tx)
                }
            })

            return {
                success: true,
                state: GROUP.UPDATE_SUCCESS,
            }
        } catch (err) {
            console.error('Update group status error:', err)
            return { success: false, state: GROUP.SERVER_ERROR }
        }
    }

    // Join/request to join a group
    static async joinGroup(data: GroupIdInput): Promise<GroupMemberResponse<GroupMember>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_MEMBER.GROUP_NOT_FOUND,
                }
            }

            // Only approved groups accept new members.
            if (group.status !== GROUP_STATUS.APPROVED) {
                return {
                    success: false,
                    state: { ...GROUP_MEMBER.GROUP_NOT_FOUND, message: '该群组尚未通过审核，暂不可加入' },
                }
            }

            // Check if already a member
            const existing = await groupMemberQueries.findByGroupAndUser({ groupId: data.groupId, userId: user.id })
            if (existing && existing.status === GROUP_MEMBER_STATUS.PENDING) {
                return {
                    success: false,
                    state: GROUP_MEMBER.ALREADY_SUBMIT,
                }
            }

            if (existing && existing.status === GROUP_MEMBER_STATUS.APPROVED) {
                return {
                    success: false,
                    state: GROUP_MEMBER.ALREADY_EXISTS,
                }
            }

            // Determine initial status based on group type
            const initialStatus = group.isPublic
                ? GROUP_MEMBER_STATUS.APPROVED
                : GROUP_MEMBER_STATUS.PENDING

            const membership = await groupMemberQueries.create({
                groupId: data.groupId,
                userId: user.id,
                role: GROUP_MEMBER_ROLE.MEMBER,
                status: initialStatus,
                joinedAt: initialStatus === GROUP_MEMBER_STATUS.APPROVED ? new Date() : undefined,
            })

            if (initialStatus === GROUP_MEMBER_STATUS.APPROVED) {
                return {
                    success: true,
                    data: membership,
                    state: GROUP_MEMBER.JOIN_SUCCESS,
                }
            } else {
                return {
                    success: true,
                    data: membership,
                    state: GROUP_MEMBER.ALREADY_SUBMIT,
                }
            }
        } catch (err) {
            console.error('Join group error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR
            }
        }
    }

    // Leave group
    static async leaveGroup(data: GroupIdInput): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findByGroupAndUser({ groupId: data.groupId, userId: user.id })
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Prevent last admin from leaving
            if (membership.role === GROUP_MEMBER_ROLE.ADMIN) {
                const adminCount = await groupMemberQueries.countByGroup({
                    groupId: data.groupId,
                    role: GROUP_MEMBER_ROLE.ADMIN,
                    status: GROUP_MEMBER_STATUS.APPROVED
                })
                if (adminCount <= 1) {
                    return {
                        success: false,
                        state: GROUP_MEMBER.LAST_ADMIN,
                    }
                }
            }

            return await this.changeMembership(membership.id, user.id, { remove: true, selfLeave: true })
        } catch (err) {
            console.error('Leave group error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }

    // Get group members
    static async getMembers(data: ListMembersByGroupInput): Promise<PaginatedGroupMemberResponse<GroupMemberWithUser>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data

            if (!user) {
                return {
                    success: false,
                    state: GROUP_MEMBER.UNAUTHORIZED,
                }
            }

            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_MEMBER.GROUP_NOT_FOUND,
                }
            }

            // Private groups: only approved members (or admins) may list members.
            // Without this gate, any user could enumerate members (incl. emails
            // and pending applicants) of any group by id.
            const isPlatformAdmin = user.role === 'admin'
            const isGroupAdmin = isPlatformAdmin || await groupMemberQueries.checkRole({
                groupId: group.id,
                userId: user.id,
                role: 'admin',
            })
            const isApprovedMember = isGroupAdmin || await groupMemberQueries.checkRole({
                groupId: group.id,
                userId: user.id,
                role: 'member',
            })

            if (!group.isPublic && !isApprovedMember) {
                return { success: false, state: GROUP_MEMBER.FORBIDDEN }
            }
            if (group.status !== GROUP_STATUS.APPROVED && !isGroupAdmin) {
                return { success: false, state: GROUP_MEMBER.FORBIDDEN }
            }

            const { limit, offset } = data

            // Regular members only see the approved roster; pending applicants
            // are visible to the group admins alone.
            const memberStatus = isGroupAdmin ? data.status : GROUP_MEMBER_STATUS.APPROVED
            const members = await groupMemberQueries.listByGroup({
                ...data,
                status: memberStatus,
            })

            const total = await groupMemberQueries.countByGroup({
                ...data,
                status: memberStatus,
            })

            return {
                success: true,
                data: {
                    items: members,
                    total,
                    limit,
                    offset
                },
                state: GROUP_MEMBER.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get members error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }

    /**
     * Role check for the *session* user inside a group.
     * The `userId` coming from the client is ignored — callers may only
     * query their own membership, which also prevents membership probing.
     */
    static async checkRole(data: CheckRoleInput): Promise<boolean> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return false
        return groupMemberQueries.checkRole({ groupId: data.groupId, userId: user.id, role: data.role })
    }

    // Update member (admin only)
    static async updateMember(data: UpdateGroupMemberInput): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findById(data)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Check if current user is admin
            const isAdmin = await groupMemberQueries.checkRole({ groupId: membership.groupId, userId: user.id, role: 'admin' })
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP_MEMBER.FORBIDDEN,
                }
            }

            // Prevent self-demotion if last admin
            if (membership.userId === user.id && data.role === GROUP_MEMBER_ROLE.MEMBER) {
                const adminCount = await groupMemberQueries.countByGroup({
                    groupId: membership.groupId,
                    role: GROUP_MEMBER_ROLE.ADMIN,
                    status: GROUP_MEMBER_STATUS.APPROVED
                })
                if (adminCount <= 1) {
                    return {
                        success: false,
                        state: GROUP_MEMBER.LAST_ADMIN,
                    }
                }
            }

            // Check status
            if (data.status && membership.status !== GROUP_MEMBER_STATUS.PENDING) {
                return {
                    success: false,
                    state: GROUP_MEMBER.INVALID_STATUS,
                }
            }

            return await this.changeMembership(data.memberId, user.id, { update: data })
        } catch (err) {
            console.error('Update member role error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }

    // Remove member (admin only)
    static async removeMember(data: GroupMemberIdInput): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findById(data)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Check if current user is admin
            const isAdmin = await groupMemberQueries.checkRole({ groupId: membership.groupId, userId: user.id, role: 'admin' })
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP_MEMBER.FORBIDDEN,
                }
            }

            // Prevent removing last admin
            if (membership.role === GROUP_MEMBER_ROLE.ADMIN) {
                const adminCount = await groupMemberQueries.countByGroup({
                    groupId: membership.groupId,
                    role: GROUP_MEMBER_ROLE.ADMIN,
                    status: GROUP_MEMBER_STATUS.APPROVED
                })
                if (adminCount <= 1) {
                    return {
                        success: false,
                        state: GROUP_MEMBER.LAST_ADMIN,
                    }
                }
            }

            return await this.changeMembership(data.memberId, user.id, { remove: true })
        } catch (err) {
            console.error('Remove member error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }
}
