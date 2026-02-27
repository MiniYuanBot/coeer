// services/GroupPostService.ts
import { GroupPost } from '../database/schemas'
import type {
    CreateGroupPostData,
    UpdateGroupPostData,
    GroupPostWithAuthor,
    GroupPostWithGroup,
    GroupPostResponse,
    PaginatedGroupPostResponse,
} from '@shared/contracts'
import {
    GROUP_MEMBER_ROLE,
    GROUP_MEMBER_STATUS,
    GROUP_POST_TYPE,
    GROUP_POST,
    GroupPostType,
} from '@shared/constants'
import { AuthService } from './AuthService'
import { groupPostQueries } from '../database/queries/groupPosts'
import { groupMemberQueries } from '../database/queries'
import { groupQueries } from '../database/queries/groups'

// Maximum number of pinned posts per group
const MAX_PINNED_POSTS = 3

export class GroupPostService {
    // Create a new post (announcement requires admin role)
    static async create(data: CreateGroupPostData): Promise<GroupPostResponse<GroupPost>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            // Check if group exists
            const group = await groupQueries.findById(data.groupId)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }

            // Check membership (must be approved member to post)
            const membership = await groupMemberQueries.findByGroupAndUser(data.groupId, user.id)
            if (!membership || membership.status !== GROUP_MEMBER_STATUS.APPROVED) {
                return {
                    success: false,
                    state: GROUP_POST.FORBIDDEN,
                }
            }

            // Check admin permission for announcement
            if (data.type === GROUP_POST_TYPE.ANNOUNCEMENT) {
                const isAdmin = membership.role === GROUP_MEMBER_ROLE.ADMIN
                if (!isAdmin) {
                    return {
                        success: false,
                        state: {
                            ...GROUP_POST.FORBIDDEN,
                            message: 'Only admin can create announcements',
                        },
                    }
                }
            }

            const post = await groupPostQueries.create({
                groupId: data.groupId,
                authorId: user.id,
                title: data.title,
                content: data.content,
                type: data.type,
                isPinned: false,
                createdAt: new Date(),
                updatedAt: new Date(),
            })

            return {
                success: true,
                data: post,
                state: GROUP_POST.CREATE_SUCCESS,
            }
        } catch (err) {
            console.error('Create post error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Get post by ID with author info
    static async getById(id: string): Promise<GroupPostResponse<GroupPostWithAuthor>> {
        try {
            const post = await groupPostQueries.findByIdWithAuthor(id)
            if (!post) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            return {
                success: true,
                data: post,
                state: GROUP_POST.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get post error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // List posts by group (pinned first, then by time desc)
    static async listByGroup(
        groupId: string,
        params: {
            type?: GroupPostType
            page?: number
            pageSize?: number
        }
    ): Promise<PaginatedGroupPostResponse<GroupPostWithAuthor>> {
        try {
            const { type, page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            // Check if group exists
            const group = await groupQueries.findById(groupId)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }

            const posts = await groupPostQueries.findByGroup(groupId, {
                type,
                limit: pageSize,
                offset,
            })

            const total = await groupPostQueries.countByGroup(groupId, { type })

            return {
                success: true,
                data: {
                    items: posts,
                    total,
                    page,
                    pageSize,
                },
                state: GROUP_POST.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List posts by group error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // List posts by author across all groups
    static async listByAuthor(
        authorId: string,
        params: {
            page?: number
            pageSize?: number
        }
    ): Promise<PaginatedGroupPostResponse<GroupPostWithGroup>> {
        try {
            const { page = 1, pageSize = 20 } = params
            const offset = (page - 1) * pageSize

            const posts = await groupPostQueries.findByAuthor(authorId, {
                limit: pageSize,
                offset,
            })

            // Count total posts by author
            const allPostsCount = await groupPostQueries.countByAuthor(authorId, {})

            return {
                success: true,
                data: {
                    items: posts,
                    total: allPostsCount,
                    page,
                    pageSize,
                },
                state: GROUP_POST.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List posts by author error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Update post (author or admin only)
    static async update(
        id: string,
        data: UpdateGroupPostData
    ): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(id)
            if (!post) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            // Check permission: author or group admin
            const isAuthor = post.authorId === user.id
            let isAdmin = false

            if (!isAuthor) {
                isAdmin = await groupMemberQueries.isRole(
                    post.groupId,
                    user.id,
                    GROUP_MEMBER_ROLE.ADMIN
                )
            }

            if (!isAuthor && !isAdmin) {
                return {
                    success: false,
                    state: GROUP_POST.FORBIDDEN,
                }
            }

            await groupPostQueries.update(id, {
                ...data,
                updatedAt: new Date(),
            })

            return {
                success: true,
                state: GROUP_POST.UPDATE_SUCCESS,
            }
        } catch (err) {
            console.error('Update post error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Delete post (author or admin only, cascades reactions/replies)
    static async delete(id: string): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(id)
            if (!post) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            // Check permission: author or group admin
            const isAuthor = post.authorId === user.id
            let isAdmin = false

            if (!isAuthor) {
                isAdmin = await groupMemberQueries.isRole(
                    post.groupId,
                    user.id,
                    GROUP_MEMBER_ROLE.ADMIN
                )
            }

            if (!isAuthor && !isAdmin) {
                return {
                    success: false,
                    state: GROUP_POST.FORBIDDEN,
                }
            }

            await groupPostQueries.delete(id)

            return {
                success: false,
                state: GROUP_POST.DELETE_SUCCESS,
            }
        } catch (err) {
            console.error('Delete post error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Toggle pin status (admin only, with max limit)
    static async togglePin(
        id: string,
        isPinned: boolean
    ): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(id)
            if (!post) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            // Only admin can pin/unpin
            const isAdmin = await groupMemberQueries.isRole(
                post.groupId,
                user.id,
                GROUP_MEMBER_ROLE.ADMIN
            )
            if (!isAdmin) {
                return {
                    success: false,
                    state: {
                        ...GROUP_POST.FORBIDDEN,
                        message: 'Only admin can pin posts',
                    },
                }
            }

            // Check max pinned limit when pinning
            if (isPinned && !post.isPinned) {
                const pinnedCount = await groupPostQueries.countByGroup(post.groupId, { isPinned: true })
                if (pinnedCount >= MAX_PINNED_POSTS) {
                    return {
                        success: false,
                        state: {
                            ...GROUP_POST.PIN_LIMIT_REACHED,
                            message: `Maximum ${MAX_PINNED_POSTS} pinned posts allowed`,
                        },
                    }
                }
            }

            await groupPostQueries.togglePin(id, isPinned)

            return {
                success: true,
                state: isPinned ? GROUP_POST.PIN_SUCCESS : GROUP_POST.UNPIN_SUCCESS,
            }
        } catch (err) {
            console.error('Toggle pin error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Get announcements for a group
    static async getAnnouncements(
        groupId: string,
        params: {
            pageSize?: number
        }
    ): Promise<PaginatedGroupPostResponse<GroupPostWithAuthor>> {
        try {
            const { pageSize = 10 } = params

            // Check if group exists
            const group = await groupQueries.findById(groupId)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }

            const posts = await groupPostQueries.findByGroup(groupId, {
                type: GROUP_POST_TYPE.ANNOUNCEMENT,
                limit: pageSize,
                offset: 0,
            })

            const total = await groupPostQueries.countByGroup(groupId, {
                type: GROUP_POST_TYPE.ANNOUNCEMENT,
            })

            return {
                success: true,
                data: {
                    items: posts,
                    total,
                    page: 1,
                    pageSize,
                },
                state: GROUP_POST.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get announcements error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Check if user can modify post (helper for other services)
    static async canModify(postId: string, userId: string): Promise<boolean> {
        const post = await groupPostQueries.findById(postId)
        if (!post) return false

        if (post.authorId === userId) return true

        return groupMemberQueries.isRole(post.groupId, userId, GROUP_MEMBER_ROLE.ADMIN)
    }
}