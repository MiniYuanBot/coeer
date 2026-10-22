// services/GroupPostService.ts
import type {
    GroupPostWithAuthor,
    GroupPostWithGroup,
    PublicGroupPost,
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
    GROUP_STATUS,
} from '@shared/constants'
import { AuthService } from './AuthService'
import { db } from '../database/client'
import { EngagementService } from './EngagementService'
import { pointQueries } from '../database/queries/points'
import { groupPostQueries } from '../database/queries/groupPosts'
import { groupMemberQueries } from '../database/queries'
import { groupQueries } from '../database/queries/groups'
import { reactionQueries } from '../database/queries/reactions'
import { bookmarkQueries } from '../database/queries/bookmarks'
import { groups } from '../database/schemas'
import { eq } from 'drizzle-orm'

// Maximum number of pinned posts per group
const MAX_PINNED_POSTS = 5

export class GroupPostService {
    static async listRecentPublic(): Promise<GroupPostResponse<PublicGroupPost[]>> {
        const payload = await AuthService.getCurrentUser()
        const posts = await groupPostQueries.findRecentPublic()
        const ids = posts.map((post) => post.id)
        const [summaries, saved] = await Promise.all([
            reactionQueries.summarizePosts(ids, payload.data?.id),
            bookmarkQueries.summarizePosts(ids, payload.data?.id),
        ])
        return {
            success: true,
            data: posts.map((post) => ({ ...post, reactionCount: 0, hasReacted: false, ...summaries.get(post.id), isBookmarked: saved.has(post.id) })),
            state: GROUP_POST.GET_SUCCESS,
        }
    }
    /**
     * Whether the given group's content may be read by the current viewer.
     * Approved + public groups are readable by everyone; everything else
     * (private groups, still-pending groups) requires an approved membership
     * or a platform admin.
     */
    private static async canReadGroup(group: { id: string; status: string; isPublic: boolean }, user?: { id: string; role: string }): Promise<boolean> {
        if (group.status === GROUP_STATUS.APPROVED && group.isPublic) return true
        if (!user) return false
        if (user.role === 'admin') return true

        const membership = await groupMemberQueries.findByGroupAndUser({ groupId: group.id, userId: user.id })
        return !!membership && membership.status === GROUP_MEMBER_STATUS.APPROVED
    }

    // Create a new post (announcement requires admin role)
    static async create(data: CreateGroupPostInput): Promise<GroupPostResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: GROUP_POST.UNAUTHORIZED }
            }

            // Check if group exists and has been approved
            const group = await groupQueries.findById(data)
            if (!group) {
                return {
                    success: false,
                    state: GROUP_POST.GROUP_NOT_FOUND,
                }
            }
            if (group.status !== GROUP_STATUS.APPROVED) {
                return {
                    success: false,
                    state: { ...GROUP_POST.FORBIDDEN, message: '群组尚未通过审核，暂不能发帖' },
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

            await db.transaction(async (tx) => {
                await pointQueries.lockUser(user.id, tx)
                const post = await groupPostQueries.create({
                    groupId: data.groupId,
                    authorId: user.id,
                    title: data.title,
                    content: data.content,
                    type: data.type,
                    isPinned: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                }, tx)
                await EngagementService.recordInTx(user.id, 'post', post.id, tx)
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

            // Visibility gate: never leak posts of private/pending groups.
            const group = await groupQueries.findById({ groupId: post.groupId })
            const payload = await AuthService.getCurrentUser()
            if (!group || !(await GroupPostService.canReadGroup(group, payload.success ? payload.data : undefined))) {
                return { success: false, state: GROUP_POST.NOT_FOUND }
            }

            return {
                success: true,
                data: { ...post, reactionCount: 0, hasReacted: false, ...(await reactionQueries.summarizePosts([post.id], payload.data?.id)).get(post.id),
                    isBookmarked: (await bookmarkQueries.summarizePosts([post.id], payload.data?.id)).has(post.id) },
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

            // Check if group exists and the caller may read it
            const group = await groupQueries.findById(data)
            const payload = await AuthService.getCurrentUser()
            if (!group || !(await GroupPostService.canReadGroup(group, payload.success ? payload.data : undefined))) {
                return {
                    success: false,
                    state: GROUP_POST.NOT_FOUND,
                }
            }

            const posts = await groupPostQueries.findByGroup(data)
            const summaries = await reactionQueries.summarizePosts(posts.map((post) => post.id), payload.data?.id)
            const saved = await bookmarkQueries.summarizePosts(posts.map((post) => post.id), payload.data?.id)

            const total = await groupPostQueries.countByGroup({ groupId, type })

            return {
                success: true,
                data: {
                    items: posts.map((post) => ({ ...post, reactionCount: 0, hasReacted: false, ...summaries.get(post.id), isBookmarked: saved.has(post.id) })),
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

            return await db.transaction(async (tx) => {
                // One lock per group keeps simultaneous pin requests within the limit.
                await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, post.groupId)).for('update')
                const current = await groupPostQueries.findById({ id: post.id }, tx)
                if (!current) return { success: false, state: GROUP_POST.NOT_FOUND }
                if (data.isPinned && !current.isPinned) {
                    const pinnedCount = await groupPostQueries.countByGroup({ groupId: post.groupId, isPinned: true }, tx)
                    if (pinnedCount >= MAX_PINNED_POSTS) {
                        return { success: false, state: { ...GROUP_POST.PIN_LIMIT_REACHED, message: `每个群组最多置顶 ${MAX_PINNED_POSTS} 条帖子，请先取消其他帖子的置顶。` } }
                    }
                }
                await groupPostQueries.togglePin(data, tx)
                return { success: true, state: data.isPinned ? GROUP_POST.PIN_SUCCESS : GROUP_POST.UNPIN_SUCCESS }
            })
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
