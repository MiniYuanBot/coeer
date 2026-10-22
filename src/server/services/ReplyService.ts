import { replyQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { REPLY } from '@shared/constants'
import { getDiscussionAccess } from '../utils/access'
import type {
    CreateReplyInput,
    ListChildRepliesInput,
    ListRepliesByAuthorInput,
    ListRepliesByTargetInput,
    PaginatedReplyResponse,
    ReplyIdInput,
    ReplyResponse,
    ReplyWithAuthor,
    ReplyWithTarget,
    UpdateReplyInput,
} from '@shared/contracts'

export class ReplyService {
    static async create(data: CreateReplyInput): Promise<ReplyResponse<ReplyWithAuthor>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REPLY.UNAUTHORIZED }

            const access = await getDiscussionAccess(data, user)
            if (!access.canReply) return { success: false, state: REPLY.FORBIDDEN }
            if (data.parentId) {
                const parent = await replyQueries.findById({ id: data.parentId })
                if (!parent || parent.targetType !== data.targetType || parent.targetId !== data.targetId) {
                    return { success: false, state: REPLY.TARGET_NOT_FOUND }
                }
            }

            const reply = await replyQueries.create({ ...data, userId: user.id })
            const withAuthor = await replyQueries.findById({ id: reply.id })
            return { success: true, data: withAuthor as ReplyWithAuthor, state: REPLY.CREATE_SUCCESS }
        } catch (err) {
            console.error('Create reply error:', err)
            return { success: false, state: REPLY.SERVER_ERROR }
        }
    }

    static async getById(data: ReplyIdInput): Promise<ReplyResponse<ReplyWithAuthor>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: REPLY.UNAUTHORIZED }
        const reply = await replyQueries.findById(data)
        if (!reply || !(await getDiscussionAccess(reply, current.data)).canRead) return { success: false, state: REPLY.NOT_FOUND }
        return { success: true, data: reply as ReplyWithAuthor, state: REPLY.GET_SUCCESS }
    }

    static async listByTarget(data: ListRepliesByTargetInput): Promise<PaginatedReplyResponse<ReplyWithAuthor>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: REPLY.UNAUTHORIZED }
        if (!(await getDiscussionAccess(data, current.data)).canRead) return { success: false, state: REPLY.TARGET_NOT_FOUND }
        const items = await replyQueries.listByTarget(data)
        const total = await replyQueries.countByTarget(data)
        return { success: true, data: { items: items as ReplyWithAuthor[], total, limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async listChildren(data: ListChildRepliesInput): Promise<PaginatedReplyResponse<ReplyWithAuthor>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: REPLY.UNAUTHORIZED }
        const parent = await replyQueries.findById({ id: data.parentId })
        if (!parent || !(await getDiscussionAccess(parent, current.data)).canRead) return { success: false, state: REPLY.NOT_FOUND }
        const items = await replyQueries.listChildren(data)
        return { success: true, data: { items: items as ReplyWithAuthor[], limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async listByAuthor(data: ListRepliesByAuthorInput): Promise<PaginatedReplyResponse<ReplyWithTarget>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: REPLY.UNAUTHORIZED }
        const items = await replyQueries.listByAuthor(data, current.data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async update(data: UpdateReplyInput): Promise<ReplyResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REPLY.UNAUTHORIZED }
            const reply = await replyQueries.findById({ id: data.id })
            if (!reply || !reply.content) return { success: false, state: REPLY.NOT_FOUND }
            const access = await getDiscussionAccess(reply, user)
            if (!access.canReply || reply.userId !== user.id) return { success: false, state: REPLY.FORBIDDEN }
            await replyQueries.update(data)
            return { success: true, state: REPLY.UPDATE_SUCCESS }
        } catch (err) {
            console.error('Update reply error:', err)
            return { success: false, state: REPLY.SERVER_ERROR }
        }
    }

    static async delete(data: ReplyIdInput): Promise<ReplyResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REPLY.UNAUTHORIZED }
            const reply = await replyQueries.findById(data)
            if (!reply) return { success: false, state: REPLY.NOT_FOUND }
            const access = await getDiscussionAccess(reply, user)
            if (!access.canRead || (reply.userId !== user.id && !access.canManage)) return { success: false, state: REPLY.FORBIDDEN }
            await replyQueries.delete(data)
            return { success: true, state: REPLY.DELETE_SUCCESS }
        } catch (err) {
            console.error('Delete reply error:', err)
            return { success: false, state: REPLY.SERVER_ERROR }
        }
    }
}

