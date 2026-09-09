import { reactionQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { REACTION } from '@shared/constants'
import { canViewTarget } from '../utils/access'
import type {
    ListMyReactionsInput,
    ListReactionsInput,
    PaginatedReactionResponse,
    ReactionResponse,
    ReactionWithTarget,
    ReactionWithUser,
    ToggleReactionInput,
} from '@shared/contracts'

export class ReactionService {
    static async toggle(data: ToggleReactionInput): Promise<ReactionResponse<{ reacted: boolean; count: number }>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REACTION.UNAUTHORIZED }

            // Only react to content the caller can actually see.
            if (!await canViewTarget(data, user)) return { success: false, state: REACTION.TARGET_NOT_FOUND }

            const existing = await reactionQueries.findByUserAndTarget(user.id, data)
            if (existing) {
                await reactionQueries.deleteById(existing.id)
                return {
                    success: true,
                    data: { reacted: false, count: await reactionQueries.countByTarget(data) },
                    state: REACTION.TOGGLE_SUCCESS,
                }
            }

            await reactionQueries.create({ userId: user.id, ...data })
            return {
                success: true,
                data: { reacted: true, count: await reactionQueries.countByTarget(data) },
                state: REACTION.TOGGLE_SUCCESS,
            }
        } catch (err) {
            console.error('Toggle reaction error:', err)
            return { success: false, state: REACTION.SERVER_ERROR }
        }
    }

    static async listByTarget(data: ListReactionsInput): Promise<PaginatedReactionResponse<ReactionWithUser>> {
        try {
            const items = await reactionQueries.listByTarget(data)
            const total = await reactionQueries.countByTarget(data)
            return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: REACTION.GET_SUCCESS }
        } catch (err) {
            console.error('List reactions error:', err)
            return { success: false, state: REACTION.SERVER_ERROR }
        }
    }

    static async listMine(data: ListMyReactionsInput): Promise<PaginatedReactionResponse<ReactionWithTarget>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: REACTION.UNAUTHORIZED }
            const items = await reactionQueries.listByUser(user.id, data)
            return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REACTION.GET_SUCCESS }
        } catch (err) {
            console.error('List my reactions error:', err)
            return { success: false, state: REACTION.SERVER_ERROR }
        }
    }
}

