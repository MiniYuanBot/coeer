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
} from '@shared/contracts'
import {
    GROUP_STATUSES,
    GROUP_MEMBER_ROLES,
    GROUP_MEMBER_STATUSES,
    GroupMemberStatuses,
    GroupCategories,
    GROUP,
    GROUP_MEMBER,
    GroupMemberRoles,
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

            const result = await db.transaction(async (tx) => {
                // Create the group
                const group = await groupQueries.create({
                    ...data,
                    creatorId: user.id,
                    status: GROUP_STATUSES.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })

                // Add creator as admin
                await groupMemberQueries.create({
                    groupId: group.id,
                    userId: user.id,
                    role: GROUP_MEMBER_ROLES.ADMIN,
                    status: GROUP_MEMBER_STATUSES.APPROVED,
                    joinedAt: new Date(),
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
                const isAdmin = await groupMemberQueries.isAdmin(id, user.id)
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

    // Get group with stats by ID
    static async getById(id: string): Promise<GroupResponse<GroupWithStats>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data

            const group = await groupQueries.findWithStats(id)

            if (!group) {
                return {
                    success: false,
                    state: GROUP.NOT_FOUND,
                }
            }

            // Check visibility permissions
            if (!group.isPublic && group.status !== GROUP_STATUSES.APPROVED) {
                // For private/pending groups, only members and admins can view
                if (!user) {
                    return {
                        success: false,
                        state: GROUP.UNAUTHORIZED,
                    }
                }

                const membership = await groupMemberQueries.findByGroupAndUser(id, user.id)
                if (!membership || membership.status !== GROUP_MEMBER_STATUSES.APPROVED) {
                    return {
                        success: false,
                        state: GROUP.FORBIDDEN,
                    }
                }
            }

            return {
                success: true,
                data: group,
                state: GROUP.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get group error:', err)
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

            // if (!group || group.status !== GROUP_STATUSES.APPROVED) {
            //     return {
            //         success: false,
            //         state: GROUP.NOT_FOUND,
            //     }
            // }

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
    static async update(id: string, data: UpdateGroupData): Promise<GroupResponse<Group>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP.UNAUTHORIZED }
            }

            // Check if user is admin
            const isAdmin = await groupMemberQueries.isAdmin(id, user.id)
            if (!isAdmin) {
                return {
                    success: false,
                    state: GROUP.FORBIDDEN,
                }
            }

            const updated = await groupQueries.update(id, {
                ...data,
                updatedAt: new Date()
            })

            return {
                success: true,
                data: updated,
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
    static async listPublic(params: {
        category?: GroupCategories
        search?: string
        page?: number
        pageSize?: number
    }): Promise<PaginatedGroupResponse<Group>> {
        try {
            const { category, search, page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            const groups = await groupQueries.listPublic({
                category,
                search,
                limit: pageSize,
                offset
            })

            const total = await groupQueries.count({
                status: GROUP_STATUSES.APPROVED,
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
        status?: GroupMemberStatuses
        page?: number
        pageSize?: number
    }): Promise<PaginatedGroupMemberResponse<Group>> {
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

            const total = await groupMemberQueries.countByUser(user.id, { status })

            return {
                success: true,
                data: {
                    items: memberships.map((item) => item.group),
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

    // // List pending groups for admin review
    // static async listPending(params: {
    //     page?: number
    //     limit?: number
    // }): Promise<GroupResponse<PaginatedGroups>> {
    //     try {
    //         const payload = await AuthService.getCurrentUser()
    //         const user = payload.data
    //         if (!payload.success || !user) {
    //             return { success: false, status: 'UNAUTHORIZED', message: '请先登录' }
    //         }

    //         // TODO: Check if user is admin/moderator
    //         // const isAdmin = await this.isAdmin()
    //         // if (!isAdmin) {
    //         //     return { success: false, status: 'FORBIDDEN', message: '只有管理员可以查看待审核群组' }
    //         // }

    //         const { page = 1, limit = 20 } = params
    //         const offset = (page - 1) * limit

    //         const groups = await groupQueries.listPending({ limit, offset })
    //         const total = await groupQueries.count({ status: GroupStatuses.PENDING })

    //         return {
    //             success: true,
    //             data: {
    //                 groups,
    //                 total,
    //                 page,
    //                 limit,
    //                 totalPages: Math.ceil(total / limit)
    //             },
    //             status: 'GET_SUCCESS',
    //             message: '获取待审核群组列表成功'
    //         }
    //     } catch (err) {
    //         console.error('List pending groups error:', err)
    //         return {
    //             success: false,
    //             status: 'SERVER_ERROR',
    //             message: '服务器错误，请稍后重试'
    //         }
    //     }
    // }

    // // Approve/reject group (mod/admin)
    // static async approveGroup(id: string, data: {
    //     approved: boolean
    //     reason?: string
    // }): Promise<GroupResponse<Group>> {
    //     try {
    //         const payload = await AuthService.getCurrentUser()
    //         const user = payload.data
    //         if (!payload.success || !user) {
    //             return { success: false, status: 'UNAUTHORIZED', message: '请先登录' }
    //         }

    //         // TODO: Check if user is admin/moderator
    //         // const isAdmin = await this.isAdmin()
    //         // if (!isAdmin) {
    //         //     return { success: false, status: 'FORBIDDEN', message: '只有管理员可以审核群组' }
    //         // }

    //         const group = await groupQueries.findById(id)
    //         if (!group) {
    //             return {
    //                 success: false,
    //                 status: 'GROUP_NOT_FOUND',
    //                 message: '群组不存在'
    //             }
    //         }

    //         if (group.status !== GroupStatuses.PENDING) {
    //             return {
    //                 success: false,
    //                 status: 'INVALID_STATUS',
    //                 message: '该群组已被审核'
    //             }
    //         }

    //         const status = data.approved ? GroupStatuses.APPROVED : GroupStatuses.REJECTED
    //         const updated = await groupQueries.updateStatus(id, status, data.reason)

    //         return {
    //             success: true,
    //             data: updated,
    //             status: data.approved ? 'APPROVE_SUCCESS' : 'REJECT_SUCCESS',
    //             message: data.approved ? '群组审核通过' : '群组已拒绝'
    //         }
    //     } catch (err) {
    //         console.error('Approve group error:', err)
    //         return {
    //             success: false,
    //             status: 'SERVER_ERROR',
    //             message: '服务器错误，请稍后重试'
    //         }
    //     }
    // }

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
            if (existing && existing.status === GROUP_MEMBER_STATUSES.PENDING) {
                return {
                    success: false,
                    state: GROUP_MEMBER.ALREADY_SUBMIT,
                }
            }

            if (existing && existing.status === GROUP_MEMBER_STATUSES.APPROVED) {
                return {
                    success: false,
                    state: GROUP_MEMBER.ALREADY_EXISTS,
                }
            }

            // Determine initial status based on group type
            const initialStatus = group.isPublic
                ? GROUP_MEMBER_STATUSES.APPROVED
                : GROUP_MEMBER_STATUSES.PENDING

            const membership = await groupMemberQueries.create({
                groupId,
                userId: user.id,
                role: GROUP_MEMBER_ROLES.MEMBER,
                status: initialStatus,
                joinedAt: initialStatus === GROUP_MEMBER_STATUSES.APPROVED ? new Date() : undefined,
            })

            if (initialStatus === GROUP_MEMBER_STATUSES.APPROVED) {
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
    static async leaveGroup(groupId: string): Promise<GroupMemberResponse<GroupMember>> {
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
            if (membership.role === GROUP_MEMBER_ROLES.ADMIN) {
                const adminCount = await groupMemberQueries.countByGroup(groupId, {
                    role: GROUP_MEMBER_ROLES.ADMIN,
                    status: GROUP_MEMBER_STATUSES.APPROVED
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
            status?: GroupMemberStatuses
            role?: GroupMemberRoles
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
            if (!group.isPublic && group.status === GROUP_STATUSES.APPROVED) {
                const membership = await groupMemberQueries.findByGroupAndUser(groupId, user.id)
                if (!membership || membership.status !== GROUP_MEMBER_STATUSES.APPROVED) {
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

    // // Update member role (admin only)
    // static async updateMemberRole(
    //     memberId: string,
    //     role: MemberRole
    // ): Promise<GroupResponse<GroupMember>> {
    //     try {
    //         const payload = await AuthService.getCurrentUser()
    //         const user = payload.data
    //         if (!payload.success || !user) {
    //             return { success: false, status: 'UNAUTHORIZED', message: '请先登录' }
    //         }

    //         const membership = await groupMemberQueries.findById(memberId)
    //         if (!membership) {
    //             return {
    //                 success: false,
    //                 status: 'MEMBER_NOT_FOUND',
    //                 message: '成员关系不存在'
    //             }
    //         }

    //         // Check if current user is admin
    //         const isAdmin = await groupMemberQueries.isAdmin(membership.groupId, user.id)
    //         if (!isAdmin) {
    //             return {
    //                 success: false,
    //                 status: 'FORBIDDEN',
    //                 message: '只有管理员可以更新成员权限'
    //             }
    //         }

    //         // Prevent self-demotion if last admin
    //         if (membership.userId === user.id && role === MemberRoles.MEMBER) {
    //             const adminCount = await groupMemberQueries.countByGroup(membership.groupId, {
    //                 role: MemberRoles.ADMIN,
    //                 status: MemberStatuses.APPROVED
    //             })
    //             if (adminCount <= 1) {
    //                 return {
    //                     success: false,
    //                     status: 'LAST_ADMIN',
    //                     message: '您是唯一的管理员，无法降级'
    //                 }
    //             }
    //         }

    //         const updated = await groupMemberQueries.updateRole(memberId, role)

    //         return {
    //             success: true,
    //             data: updated,
    //             status: 'UPDATE_SUCCESS',
    //             message: `已${role === MemberRoles.ADMIN ? '设为' : '取消'}管理员`
    //         }
    //     } catch (err) {
    //         console.error('Update member role error:', err)
    //         return {
    //             success: false,
    //             status: 'SERVER_ERROR',
    //             message: '服务器错误，请稍后重试'
    //         }
    //     }
    // }

    // // Remove member (admin only)
    // static async removeMember(memberId: string): Promise<GroupResponse<GroupMember>> {
    //     try {
    //         const payload = await AuthService.getCurrentUser()
    //         const user = payload.data
    //         if (!payload.success || !user) {
    //             return { success: false, status: 'UNAUTHORIZED', message: '请先登录' }
    //         }

    //         const membership = await groupMemberQueries.findById(memberId)
    //         if (!membership) {
    //             return {
    //                 success: false,
    //                 status: 'MEMBER_NOT_FOUND',
    //                 message: '成员关系不存在'
    //             }
    //         }

    //         // Check if current user is admin
    //         const isAdmin = await groupMemberQueries.isAdmin(membership.groupId, user.id)
    //         if (!isAdmin) {
    //             return {
    //                 success: false,
    //                 status: 'FORBIDDEN',
    //                 message: '只有管理员可以移除成员'
    //             }
    //         }

    //         // Prevent removing last admin
    //         if (membership.role === MemberRoles.ADMIN) {
    //             const adminCount = await groupMemberQueries.countByGroup(membership.groupId, {
    //                 role: MemberRoles.ADMIN,
    //                 status: MemberStatuses.APPROVED
    //             })
    //             if (adminCount <= 1) {
    //                 return {
    //                     success: false,
    //                     status: 'LAST_ADMIN',
    //                     message: '无法移除唯一的管理员'
    //                 }
    //             }
    //         }

    //         const deleted = await groupMemberQueries.delete(memberId)

    //         return {
    //             success: true,
    //             data: deleted,
    //             status: 'DELETE_SUCCESS',
    //             message: '成员已移除'
    //         }
    //     } catch (err) {
    //         console.error('Remove member error:', err)
    //         return {
    //             success: false,
    //             status: 'SERVER_ERROR',
    //             message: '服务器错误，请稍后重试'
    //         }
    //     }
    // }

    // // Approve join request (admin only)
    // static async approveMember(memberId: string): Promise<GroupResponse<GroupMember>> {
    //     try {
    //         const payload = await AuthService.getCurrentUser()
    //         const user = payload.data
    //         if (!payload.success || !user) {
    //             return { success: false, status: 'UNAUTHORIZED', message: '请先登录' }
    //         }

    //         const membership = await groupMemberQueries.findById(memberId)
    //         if (!membership) {
    //             return {
    //                 success: false,
    //                 status: 'MEMBER_NOT_FOUND',
    //                 message: '申请不存在'
    //             }
    //         }

    //         // Check if current user is admin
    //         const isAdmin = await groupMemberQueries.isAdmin(membership.groupId, user.id)
    //         if (!isAdmin) {
    //             return {
    //                 success: false,
    //                 status: 'FORBIDDEN',
    //                 message: '只有管理员可以审核入群申请'
    //             }
    //         }

    //         if (membership.status !== MemberStatuses.PENDING) {
    //             return {
    //                 success: false,
    //                 status: 'INVALID_STATUS',
    //                 message: '该申请已被处理'
    //             }
    //         }

    //         const updated = await groupMemberQueries.updateStatus(memberId, MemberStatuses.APPROVED)

    //         return {
    //             success: true,
    //             data: updated,
    //             status: 'APPROVE_SUCCESS',
    //             message: '入群申请已通过'
    //         }
    //     } catch (err) {
    //         console.error('Approve member error:', err)
    //         return {
    //             success: false,
    //             status: 'SERVER_ERROR',
    //             message: '服务器错误，请稍后重试'
    //         }
    //     }
    // }
}