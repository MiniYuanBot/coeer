import type { DbUser, Feedback, NewFeedback } from '~/database/schemas'
import { FeedbackTargetTypes } from '../constants'
import { ActionResponse } from './action'

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

export type FeedbackList = {
    feedbacks: FeedbackWithAuthor[]
    total: number
}

export type FeedbackStatus =
    | 'FEEDBACK_NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'GET_SUCCESS'
    | 'SERVER_ERROR'
    | 'CREATE_SUCCESS'
    | 'UPDATE_SUCCESS'
    | 'DELETE_SUCCESS'
// | 'REPLY_SUCCESS'
// | 'STATUS_UPDATE_SUCCESS'

export type FeedbackResponse<T> = ActionResponse<T, FeedbackStatus>
