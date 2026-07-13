// services/GroupPostService.ts
import type {
    GroupPostWithAuthor,
    GroupPostWithGroup,
    GroupPostResponse,
    PaginatedGroupPostResponse,
    CreateGroupPostInput,
    UpdateGroupPostInput,
    GroupPostIdInput,
    ListPostsByGroupInput,
    ListPostsByAuthorInput,
    TogglePinInput,
    CheckModifyInput,
} from '@shared/contracts'
import {
    GROUP_MEMBER_ROLE,
    GROUP_MEMBER_STATUS,
    GROUP_POST_TYPE,
    GROUP_POST,
} from '@shared/constants'
import { AuthService } from './AuthService'
import { groupPostQueries } from '../database/queries/groupPosts'
import { groupMemberQueries } from '../database/queries'
import { groupQueries } from '../database/queries/groups'

// Maximum number of pinned posts per group
const MAX_PINNED_POSTS = 3

export class GroupPostService {
    // Create a new post (announcement requires admin role)
    static async create(data: CreateGroupPostInput): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            // Check if group exists
            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }

            // Check membership (must be approved member to post)
            const membership = await groupMemberQueries.findByGroupAndUser({ groupId: data.groupId, userId: user.id })
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

            await groupPostQueries.create({
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

    // Update post (author or admin only)
    static async update(data: UpdateGroupPostInput): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(data)
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
                isAdmin = await groupMemberQueries.checkRole({
                    groupId: post.groupId,
                    userId: user.id,
                    role: GROUP_MEMBER_ROLE.ADMIN
                })
            }

            if (!isAuthor && !isAdmin) {
                return {
                    success: false,
                    state: GROUP_POST.FORBIDDEN,
                }
            }

            await groupPostQueries.update({
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
    static async delete(data: GroupPostIdInput): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(data)
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
                isAdmin = await groupMemberQueries.checkRole({
                    groupId: post.groupId,
                    userId: user.id,
                    role: GROUP_MEMBER_ROLE.ADMIN
                })
            }

            if (!isAuthor && !isAdmin) {
                return {
                    success: false,
                    state: GROUP_POST.FORBIDDEN,
                }
            }

            await groupPostQueries.delete(data)

            return {
                success: true,
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

    // Get post by ID with author info
    static async getById(data: GroupPostIdInput): Promise<GroupPostResponse<GroupPostWithAuthor>> {
        try {
            const post = await groupPostQueries.findById(data)
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
    static async listByGroup(data: ListPostsByGroupInput): Promise<PaginatedGroupPostResponse<GroupPostWithAuthor>> {
        try {
            const { groupId, type, limit, offset } = data

            // Check if group exists
            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }

            const posts = await groupPostQueries.findByGroup(data)

            const total = await groupPostQueries.countByGroup({ groupId, type })

            return {
                success: true,
                data: {
                    items: posts,
                    total,
                    limit,
                    offset,
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
    static async listByAuthor(data: ListPostsByAuthorInput): Promise<PaginatedGroupPostResponse<GroupPostWithGroup>> {
        try {
            const { authorId, limit, offset } = data

            const posts = await groupPostQueries.findByAuthor(data)

            // Count total posts by author
            const allPostsCount = await groupPostQueries.countByAuthor({ authorId })

            return {
                success: true,
                data: {
                    items: posts,
                    total: allPostsCount,
                    limit,
                    offset,
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

    // Toggle pin status (admin only, with max limit)
    static async togglePin(data: TogglePinInput): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            const post = await groupPostQueries.findById(data)
            if (!post) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            // Only admin can pin/unpin
            const isAdmin = await groupMemberQueries.checkRole({
                groupId: post.groupId,
                userId: user.id,
                role: GROUP_MEMBER_ROLE.ADMIN,
            })
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
            if (data.isPinned && !post.isPinned) {
                const pinnedCount = await groupPostQueries.countByGroup({ groupId: post.groupId, isPinned: true })
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

            await groupPostQueries.togglePin(data)

            return {
                success: true,
                state: data.isPinned ? GROUP_POST.PIN_SUCCESS : GROUP_POST.UNPIN_SUCCESS,
            }
        } catch (err) {
            console.error('Toggle pin error:', err)
            return {
                success: false,
                state: GROUP_POST.SERVER_ERROR,
            }
        }
    }

    // Check if user can modify post
    static async checkModify(data: CheckModifyInput): Promise<boolean> {
        const post = await groupPostQueries.findById({ id: data.postId })
        if (!post) return false

        if (post.authorId === data.userId) return true

        return groupMemberQueries.checkRole({
            groupId: post.groupId,
            userId: data.userId,
            role: GROUP_MEMBER_ROLE.ADMIN
        })
    }
}
