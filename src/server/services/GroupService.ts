// services/GroupService.ts
import { db } from '../database/client'
import { Group, GroupMember } from '../database/schemas'
import type {
    CreateGroupData,
    GroupWithStats,
    GroupResponse,
    PaginatedGroupResponse,
    GroupMemberResponse,
    PaginatedGroupMemberResponse,
    UpdateGroupData,
    GroupMemberWithGroup,
    GroupMemberWithUser,
    GroupWithCreator,
} from '@shared/contracts'
import {
    GROUP_STATUS,
    GROUP_MEMBER_ROLE,
    GROUP_MEMBER_STATUS,
    GroupMemberStatus,
    GroupCategory,
    GROUP,
    GROUP_MEMBER,
    GroupMemberRole,
} from '@shared/constants'
import { AuthService } from './AuthService'
import { groupQueries } from '../database/queries/groups'
import { groupMemberQueries } from '../database/queries'

export class GroupService {
    // Create a group
    static async create(data: CreateGroupData): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if slug is already taken
            const existingGroup = await groupQueries.findBySlug(data.slug)
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

    // Delete a group
    static async delete(id: string): Promise<GroupResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            const group = await groupQueries.findById(id)
            if (!group) {
                return {
                    success: false,
                    state: GROUP.NOT_FOUND,
                }
            }

            // Check if user is creator or admin
            if (group.creatorId !== user.id) {
                const isAdmin = await groupMemberQueries.isRole(id, user.id, 'admin')
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

            await groupQueries.delete(id)

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
    static async getBySlug(slug: string): Promise<GroupResponse<GroupWithStats>> {
        try {
            const group = await groupQueries.findBySlug(slug)

            if (!group || group.status !== GROUP_STATUS.APPROVED) {
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

    // Update group info (admin only)
    static async update(id: string, data: UpdateGroupData): Promise<GroupResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if user is admin
            const isAdmin = await groupMemberQueries.isRole(id, user.id, 'admin')
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP.FORBIDDEN,
                }
            }

            await groupQueries.update(id, {
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

    // List public approved groups
    static async listApproved(params: {
        category?: GroupCategory
        search?: string
        page?: number
        pageSize?: number
    }): Promise<PaginatedGroupResponse<GroupWithCreator>> {
        try {
            const { category, search, page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            const groups = await groupQueries.listApproved({
                category,
                search,
                limit: pageSize,
                offset
            })

            const total = await groupQueries.count({
                status: GROUP_STATUS.APPROVED,
                category,
                search
            })

            return {
                success: true,
                data: {
                    items: groups,
                    total,
                    page,
                    pageSize
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
    static async listMyGroups(params: {
        status?: GroupMemberStatus
        page?: number
        pageSize?: number
    }): Promise<PaginatedGroupMemberResponse<GroupMemberWithGroup>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const { status, page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            const memberships = await groupMemberQueries.findGroupsByUser(user.id, {
                status,
                limit: pageSize,
                offset
            })
            const approvedMemberships = memberships.filter(member => member.group.status === GROUP_STATUS.APPROVED)

            const total = await groupMemberQueries.countByUser(user.id, { status })

            return {
                success: true,
                data: {
                    items: approvedMemberships,
                    total,
                    page,
                    pageSize
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

    // List pending groups for admin review
    static async listPending(params: {
        page?: number
        pageSize?: number
    }): Promise<PaginatedGroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // TODO: Check if user is admin/moderator
            // const isAdmin = await this.isAdmin()
            // if (!isAdmin) {
            //     return { success: false, state: 'FORBIDDEN' }
            // }

            const { page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            const groups = await groupQueries.listPending({ limit: pageSize, offset })
            const total = await groupQueries.count({ status: GROUP_STATUS.PENDING })

            return {
                success: true,
                data: {
                    items: groups,
                    total,
                    page,
                    pageSize,
                },
                state: GROUP.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List pending groups error:', err)
            return {
                success: false,
                state: GROUP.SERVER_ERROR,
            }
        }
    }

    // Approve/reject group (mod/admin)
    static async approveGroup(id: string, data: {
        approved: boolean
        reason?: string
    }): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // TODO: Check if user is admin/moderator
            // const isAdmin = await this.isAdmin()
            // if (!isAdmin) {
            //     return { success: false, state: 'FORBIDDEN' }
            // }

            const group = await groupQueries.findById(id)
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
            const updated = await groupQueries.updateStatus(id, status, data.reason)

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

    // Join/request to join a group
    static async joinGroup(groupId: string): Promise<GroupMemberResponse<GroupMember>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const group = await groupQueries.findById(groupId)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_MEMBER.GROUP_NOT_FOUND,
                }
            }

            // Check if already a member
            const existing = await groupMemberQueries.findByGroupAndUser(groupId, user.id)
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
                groupId,
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
    static async leaveGroup(groupId: string): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findByGroupAndUser(groupId, user.id)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Prevent last admin from leaving
            if (membership.role === GROUP_MEMBER_ROLE.ADMIN) {
                const adminCount = await groupMemberQueries.countByGroup(groupId, {
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

            await groupMemberQueries.delete(membership.id)

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

    // Get group members (members only for private groups)
    static async getMembers(
        groupId: string,
        params: {
            status?: GroupMemberStatus
            role?: GroupMemberRole
            page?: number
            pageSize?: number
        }
    ): Promise<PaginatedGroupMemberResponse<GroupMemberWithUser>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data

            if (!user) {
                return {
                    success: false,
                    state: GROUP_MEMBER.UNAUTHORIZED,
                }
            }

            const group = await groupQueries.findById(groupId)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_MEMBER.GROUP_NOT_FOUND,
                }
            }

            // Check permissions for private groups
            if (!group.isPublic && group.status === GROUP_STATUS.APPROVED) {
                const membership = await groupMemberQueries.findByGroupAndUser(groupId, user.id)
                if (!membership || membership.status !== GROUP_MEMBER_STATUS.APPROVED) {
                    return {
                        success: false,
                        state: GROUP_MEMBER.FORBIDDEN,
                    }
                }
            }

            const { role, status, page = 1, pageSize = 50 } = params
            const offset = (page - 1) * pageSize

            const members = await groupMemberQueries.findMembersByGroup(groupId, {
                role,
                status,
                limit: pageSize,
                offset
            })

            const total = await groupMemberQueries.countByGroup(groupId, { status })

            return {
                success: true,
                data: {
                    items: members,
                    total,
                    page,
                    pageSize
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
    static async isRole(groupId: string, userId: string, role: GroupMemberRole): Promise<boolean> {
        return groupMemberQueries.isRole(groupId, userId, role)
    }

    // Update member role (admin only)
    static async updateMemberRole(
        memberId: string,
        role: GroupMemberRole
    ): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findById(memberId)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Check if current user is admin
            const isAdmin = await groupMemberQueries.isRole(membership.groupId, user.id, 'admin')
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP_MEMBER.FORBIDDEN,
                }
            }

            // Prevent self-demotion if last admin
            if (membership.userId === user.id && role === GROUP_MEMBER_ROLE.MEMBER) {
                const adminCount = await groupMemberQueries.countByGroup(membership.groupId, {
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

            await groupMemberQueries.updateRole(memberId, role)

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
    static async removeMember(memberId: string): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findById(memberId)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Check if current user is admin
            const isAdmin = await groupMemberQueries.isRole(membership.groupId, user.id, 'admin')
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP_MEMBER.FORBIDDEN,
                }
            }

            // Prevent removing last admin
            if (membership.role === GROUP_MEMBER_ROLE.ADMIN) {
                const adminCount = await groupMemberQueries.countByGroup(membership.groupId, {
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

            await groupMemberQueries.delete(memberId)

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

    // Approve join request (admin only)
    static async approveMember(memberId: string): Promise<GroupMemberResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_MEMBER.UNAUTHORIZED }
            }

            const membership = await groupMemberQueries.findById(memberId)
            if (!membership) {
                return {
                    success: false,
                    state: GROUP_MEMBER.NOT_FOUND,
                }
            }

            // Check if current user is admin
            const isAdmin = await groupMemberQueries.isRole(membership.groupId, user.id, 'admin')
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP_MEMBER.FORBIDDEN,
                }
            }

            if (membership.status !== GROUP_MEMBER_STATUS.PENDING) {
                return {
                    success: false,
                    state: GROUP_MEMBER.INVALID_STATUS,
                }
            }

            const updated = await groupMemberQueries.updateStatus(memberId, GROUP_MEMBER_STATUS.APPROVED)

            return {
                success: true,
                data: updated,
                state: GROUP_MEMBER.APPROVE_SUCCESS,
            }
        } catch (err) {
            console.error('Approve member error:', err)
            return {
                success: false,
                state: GROUP_MEMBER.SERVER_ERROR,
            }
        }
    }
}