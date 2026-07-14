// services/GroupService.ts
import { db } from '../database/client'
import { Group, GroupMember } from '../database/schemas'
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

            const result = await db.transaction(async () => {
                // Create the group
                const group = await groupQueries.create({
                    ...data,
                    creatorId: user.id,
                    status: GROUP_STATUS.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })

                // Add creator as admin
                await groupMemberQueries.create({
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

            // Check if user is creator or admin
            if (group.creatorId !== user.id) {
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

    // Approve/reject group (mod/admin)
    static async approveGroup(data: ApproveGroupInput): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if user is admin
            const isAdmin = await groupMemberQueries.checkRole({ groupId: data.id, userId: user.id, role: 'admin' })
            if (!isAdmin) {
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
            await groupQueries.updateStatus({ id: data.id, status, rejectedReason: data.rejectedReason })

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

            await groupQueries.updateStatus(data)

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

            await groupMemberQueries.delete({ memberId: membership.id })

            return {
                success: true,
                state: GROUP_MEMBER.LEAVE_SUCCESS,
            }
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

            // Check permissions for private groups
            // if (!group.isPublic && group.status === GROUP_STATUS.APPROVED) {
            //     const membership = await groupMemberQueries.findByGroupAndUser({groupId: data.groupId, userId: user.id})
            //     if (!membership || membership.status !== GROUP_MEMBER_STATUS.APPROVED) {
            //         return {
            //             success: false,
            //             state: GROUP_MEMBER.FORBIDDEN,
            //         }
            //     }
            // }

            const { limit, offset } = data

            const members = await groupMemberQueries.listByGroup(data)

            const total = await groupMemberQueries.countByGroup(data)

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

    // Check if user is group admin/member
    static async checkRole(data: CheckRoleInput): Promise<boolean> {
        return groupMemberQueries.checkRole(data)
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

            await groupMemberQueries.update(data)

            return {
                success: true,
                state: GROUP_MEMBER.UPDATE_SUCCESS,
            }
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

            await groupMemberQueries.delete(data)

            return {
                success: true,
                state: GROUP_MEMBER.DELETE_SUCCESS,
            }
        } catch (err) {
            console.error('Remove member error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }
}
