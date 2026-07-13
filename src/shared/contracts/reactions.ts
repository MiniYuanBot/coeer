import { z } from 'zod'
import type { DbUser, Feedback, GroupPost, Reaction } from '~/database/schemas'
import { ReactionCode, REACTION_TARGET_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const ToggleReactionSchema = z.object({
    targetType: z.enum(REACTION_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
})

export const ListReactionsSchema = z.object({
    targetType: z.enum(REACTION_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
    ...PaginationSchema.shape,
})

export const ListMyReactionsSchema = z.object({
    targetType: z.enum(REACTION_TARGET_TYPE_ARRAY).optional(),
    ...PaginationSchema.shape,
})

export type ToggleReactionInput = z.infer<typeof ToggleReactionSchema>
export type ListReactionsInput = z.infer<typeof ListReactionsSchema>
export type ListMyReactionsInput = z.infer<typeof ListMyReactionsSchema>

export type ReactionWithUser = Reaction & {
    user: Pick<DbUser, 'id' | 'name'> | null
}

export type ReactionWithTarget = Reaction & {
    target?: Pick<GroupPost, 'id' | 'title'> | Pick<Feedback, 'id' | 'title'> | null
}

export type ReactionResponse<T> = ActionResponse<T, ReactionCode>
export type PaginatedReactionResponse<T> = PaginatedActionResponse<T, ReactionCode>

