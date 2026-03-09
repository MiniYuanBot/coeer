import z from 'zod'
import type { DbUser, Feedback, FeedbackStatusLog } from '~/database/schemas'
import {
    FeedbackCode,
    FEEDBACK_TARGET_TYPE_ARRAY,
    FEEDBACK_STATUS_ARRAY
} from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

// ===== Zod Schemas ======

export const FeedbackIdSchema = z.object({
    id: z.uuid(),
})

export const CreateFeedbackSchema = z.object({
    targetType: z.enum(FEEDBACK_TARGET_TYPE_ARRAY),
    targetDesc: z.string().optional(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    isAnonymous: z.boolean().optional().default(false),
    // images: z.array(z.string().url()).optional(),
})

export const UpdateFeedbackSchema = z.object({
    id: z.uuid(),
    status: z.enum(FEEDBACK_STATUS_ARRAY),
    resolvedAt: z.date().optional(),
})

export const FeedbackFilterSchema = z.object({
    targetType: z.enum(FEEDBACK_TARGET_TYPE_ARRAY).optional(),
    status: z.enum(FEEDBACK_STATUS_ARRAY).optional(),
    search: z.string().optional(),
})

export const CountFeedbacksSchema = z.object({
<<<<<<< Updated upstream
=======
    authorId: z.uuid().optional(),
>>>>>>> Stashed changes
    ...FeedbackFilterSchema.shape,
})

export const ListFeedbacksSchema = z.object({
    ...CountFeedbacksSchema.shape,
    ...PaginationSchema.shape
})

export const ListFeedbackStatusSchema = z.object({
    feedbackId: z.uuid(),
    ...PaginationSchema.shape
})

export const FeedbackStatsSchema = z.object({
    startDate: z.date().optional(),
    endDate: z.date().optional(),
})

export const UpdateFeedbackStatusSchema = z.object({
    id: z.uuid(),
    status: z.enum(FEEDBACK_STATUS_ARRAY),
    search: z.string().optional(),
    authorId: z.uuid().optional(),
    note: z.string().max(1000).optional(),
})

// ===== Typescript Types =====

// Types from Zod
export type FeedbackIdInput = z.infer<typeof FeedbackIdSchema>
export type CreateFeedbackInput = z.infer<typeof CreateFeedbackSchema>
export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>
export type FeedbackFilterInput = z.infer<typeof FeedbackFilterSchema>
export type CountFeedbacksInput = z.infer<typeof CountFeedbacksSchema>
export type ListFeedbacksInput = z.infer<typeof ListFeedbacksSchema>
export type ListFeedbackStatusInput = z.infer<typeof ListFeedbackStatusSchema>
export type FeedbackStatsInput = z.infer<typeof FeedbackStatsSchema>
export type UpdateFeedbackStatusInput = z.infer<typeof UpdateFeedbackStatusSchema>

export type FeedbackWithAuthor = Feedback & {
    author: Pick<DbUser, 'id' | 'name' | 'email'> | null
}

export type FeedbackStatusLogWithUser = FeedbackStatusLog & {
    changedBy: Pick<DbUser, 'id' | 'name'> | null
}

export type FeedbackStats = {
    total: number
    pending: number
    processing: number
    resolved: number
    invalid: number
    avgResolveTime: number
}

// export type AddReplyData = {
//     reply: string
// }

export type FeedbackResponse<T> = ActionResponse<T, FeedbackCode>
export type PaginatedFeedbackResponse<T> = PaginatedActionResponse<T, FeedbackCode>
