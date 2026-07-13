import { z } from 'zod'
import type { DbUser, Feedback, GroupPost, Reply } from '~/database/schemas'
import { ReplyCode, REPLY_TARGET_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const ReplyIdSchema = z.object({
    id: z.uuid(),
})

export const CreateReplySchema = z.object({
    targetType: z.enum(REPLY_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
    parentId: z.uuid().optional(),
    content: z.string().min(1).max(2000),
})

export const UpdateReplySchema = z.object({
    id: z.uuid(),
    content: z.string().min(1).max(2000),
})

export const ListRepliesByTargetSchema = z.object({
    targetType: z.enum(REPLY_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
    ...PaginationSchema.shape,
})

export const ListChildRepliesSchema = z.object({
    parentId: z.uuid(),
    ...PaginationSchema.shape,
})

export const ListRepliesByAuthorSchema = z.object({
    authorId: z.uuid(),
    ...PaginationSchema.shape,
})

export type ReplyIdInput = z.infer<typeof ReplyIdSchema>
export type CreateReplyInput = z.infer<typeof CreateReplySchema>
export type UpdateReplyInput = z.infer<typeof UpdateReplySchema>
export type ListRepliesByTargetInput = z.infer<typeof ListRepliesByTargetSchema>
export type ListChildRepliesInput = z.infer<typeof ListChildRepliesSchema>
export type ListRepliesByAuthorInput = z.infer<typeof ListRepliesByAuthorSchema>

export type ReplyWithAuthor = Reply & {
    author: Pick<DbUser, 'id' | 'name'> | null
}

export type ReplyWithTarget = Reply & {
    target?: Pick<GroupPost, 'id' | 'title'> | Pick<Feedback, 'id' | 'title'> | null
}

export type ReplyResponse<T> = ActionResponse<T, ReplyCode>
export type PaginatedReplyResponse<T> = PaginatedActionResponse<T, ReplyCode>

