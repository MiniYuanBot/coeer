import { communityTextSchema } from './unicode'
import { z } from 'zod'
import type { DbUser, Feedback, GroupPost, Reply } from '~/database/schemas'
import { ReplyCode, REPLY_TARGET_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginatedData, PaginationSchema } from './shared'

export const ReplyIdSchema = z.object({
    id: z.uuid(),
})

export const CreateReplySchema = z.object({
    targetType: z.enum(REPLY_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
    parentId: z.uuid().optional(),
    content: communityTextSchema(2000).refine(value => value.trim().length > 0, '请输入回复内容'),
})

export const UpdateReplySchema = z.object({
    id: z.uuid(),
    content: communityTextSchema(2000).refine(value => value.trim().length > 0, '请输入回复内容'),
})

export const ListRepliesByTargetSchema = z.object({
    targetType: z.enum(REPLY_TARGET_TYPE_ARRAY),
    targetId: z.uuid(),
    rootsOnly: z.boolean().optional(),
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
    author: (Pick<DbUser, 'id' | 'name'> & { avatarUrl?: string | null }) | null
}

export type ReplyListItem = ReplyWithAuthor & { childCount: number }
// In rootsOnly mode, total paginates discussions; replyTotal counts replies at every level.
export type ReplyListResponse = ReplyResponse<PaginatedData<ReplyListItem> & { replyTotal?: number }>

export type ReplyWithTarget = Reply & {
    target?: Pick<GroupPost, 'id' | 'title'> | Pick<Feedback, 'id' | 'title'> | null
}

export type ReplyResponse<T> = ActionResponse<T, ReplyCode>
export type PaginatedReplyResponse<T> = PaginatedActionResponse<T, ReplyCode>

