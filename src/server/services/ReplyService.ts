import { replyQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { REPLY } from '@shared/constants'
import { canViewTarget } from '../utils/access'
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

            // Only comment on content the caller can actually see (private /
            // pending group posts and non-public feedbacks are off-limits).
            if (!await canViewTarget(data, user)) return { success: false, state: REPLY.TARGET_NOT_FOUND }

            const reply = await replyQueries.create({ ...data, userId: user.id })
            const withAuthor = await replyQueries.findById({ id: reply.id })
            return { success: true, data: withAuthor as ReplyWithAuthor, state: REPLY.CREATE_SUCCESS }
        } catch (err) {
            console.error('Create reply error:', err)
            return { success: false, state: REPLY.SERVER_ERROR }
        }
    }

    static async getById(data: ReplyIdInput): Promise<ReplyResponse<ReplyWithAuthor>> {
        const reply = await replyQueries.findById(data)
        if (!reply) return { success: false, state: REPLY.NOT_FOUND }
        return { success: true, data: reply as ReplyWithAuthor, state: REPLY.GET_SUCCESS }
    }

    static async listByTarget(data: ListRepliesByTargetInput): Promise<PaginatedReplyResponse<ReplyWithAuthor>> {
        const items = await replyQueries.listByTarget(data)
        const total = await replyQueries.countByTarget(data)
        return { success: true, data: { items: items as ReplyWithAuthor[], total, limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async listChildren(data: ListChildRepliesInput): Promise<PaginatedReplyResponse<ReplyWithAuthor>> {
        const items = await replyQueries.listChildren(data)
        return { success: true, data: { items: items as ReplyWithAuthor[], limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async listByAuthor(data: ListRepliesByAuthorInput): Promise<PaginatedReplyResponse<ReplyWithTarget>> {
        const items = await replyQueries.listByAuthor(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REPLY.GET_SUCCESS }
    }

    static async update(data: UpdateReplyInput): Promise<ReplyResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REPLY.UNAUTHORIZED }
            const reply = await replyQueries.findById({ id: data.id })
            if (!reply) return { success: false, state: REPLY.NOT_FOUND }
            if (reply.userId !== user.id && user.role !== 'admin') return { success: false, state: REPLY.FORBIDDEN }
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
            if (reply.userId !== user.id && user.role !== 'admin') return { success: false, state: REPLY.FORBIDDEN }
            await replyQueries.delete(data)
            return { success: true, state: REPLY.DELETE_SUCCESS }
        } catch (err) {
            console.error('Delete reply error:', err)
            return { success: false, state: REPLY.SERVER_ERROR }
        }
    }
}

