import type { DbUser, Feedback, NewFeedback } from '~/database/schemas'
import { FeedbackTargetTypes, FeedbackCode } from '../constants'
import { ActionResponse, PaginatedActionResponse } from './action'

export type FeedbackWithAuthor = Feedback & {
    author: Pick<DbUser, 'id' | 'name' | 'email'> | null
}

// export type FeedbackStatusLogWithUser = FeedbackStatusLog & {
//     changedBy: Pick<DbUser, 'id' | 'name'> | null
// }

export type CreateFeedbackData = {
    targetType: FeedbackTargetTypes
    targetDesc: string
    title: string
    content: string
    // images?: string[]
    isAnonymous: boolean
}

// export type UpdateStatusData = {
//     status: string
//     note?: string
// }

// export type AddReplyData = {
//     reply: string
// }

// export type FeedbackList = {
//     feedbacks: FeedbackWithAuthor[]
//     total: number
// }

export type FeedbackResponse<T> = ActionResponse<T, FeedbackCode>
export type PaginatedFeedbackResponse<T> = PaginatedActionResponse<T, FeedbackCode>
