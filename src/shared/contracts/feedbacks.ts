import z from 'zod'
import type { DbUser, Feedback, FeedbackStatusLog } from '~/database/schemas'
import {
    FeedbackTargetType,
    FeedbackCode,
    FeedbackStatus,
    FEEDBACK_TARGET_TYPE_ARRAY,
    FEEDBACK_STATUS_ARRAY
} from '../constants'
import { ActionResponse, PaginatedActionResponse } from './action'

export const CreateFeedbackSchema = z.object({
    targetType: z.enum(FEEDBACK_TARGET_TYPE_ARRAY),
    targetDesc: z.string().optional(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    isAnonymous: z.boolean().optional().default(false),
    // images: z.array(z.string().url()).optional(),
})

export const UpdateFeedbackStatusSchema = z.object({
    id: z.string(),
    status: z.enum(FEEDBACK_STATUS_ARRAY),
    note: z.string().max(1000).optional(),
})

export type FeedbackWithAuthor = Feedback & {
    author: Pick<DbUser, 'id' | 'name' | 'email'> | null
}

export type FeedbackStatusLogWithUser = FeedbackStatusLog & {
    changedBy: Pick<DbUser, 'id' | 'name'> | null
}

export type CreateFeedbackData = {
    targetType: FeedbackTargetType
    targetDesc?: string
    title: string
    content: string
    // images?: string[]
    isAnonymous: boolean
}

export type UpdateFeedbackStatusData = {
    status: FeedbackStatus
    note?: string
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

// export type FeedbackList = {
//     feedbacks: FeedbackWithAuthor[]
//     total: number
// }

export type FeedbackResponse<T> = ActionResponse<T, FeedbackCode>
export type PaginatedFeedbackResponse<T> = PaginatedActionResponse<T, FeedbackCode>
