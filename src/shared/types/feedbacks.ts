import type { DbUser, Feedback, NewFeedback } from '~/database/schemas'

export type FeedbackWithAuthor = Feedback & {
    author: Pick<DbUser, 'id' | 'name' | 'email'> | null
}

// export type FeedbackStatusLogWithUser = FeedbackStatusLog & {
//     changedBy: Pick<DbUser, 'id' | 'name'> | null
// }

export type CreateFeedbackData = {
    targetType: 'academic' | 'office' | 'general'
    targetDesc: string
    title: string
    content: string
    images?: string[]
    isAnonymous: boolean
}

export type UpdateStatusData = {
    status: string
    note?: string
}

// export type AddReplyData = {
//     reply: string
// }

export type FeedbackResponse<T> = {
    success: boolean
    data?: T
    message?: string
    error?: string
}

export type FeedbackListResponse = {
    feedbacks: FeedbackWithAuthor[]
    total: number
}

export type FeedbackStatusMessages = 
    | 'FEEDBACK_NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'SERVER_ERROR'
    | 'CREATE_SUCCESS'
    | 'UPDATE_SUCCESS'
    | 'DELETE_SUCCESS'
    | 'REPLY_SUCCESS'
    | 'STATUS_UPDATE_SUCCESS'