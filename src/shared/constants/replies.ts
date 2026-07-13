export const REPLY_TARGET_TYPE = {
    GROUP_POST: 'group_post',
    FEEDBACK: 'feedback',
} as const

export type ReplyTargetType = typeof REPLY_TARGET_TYPE[keyof typeof REPLY_TARGET_TYPE]
export const REPLY_TARGET_TYPE_ARRAY = ['group_post', 'feedback'] as const

export const REPLY = {
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    NOT_FOUND: { code: 'REPLY_NOT_FOUND', message: 'Reply not found' } as const,
    TARGET_NOT_FOUND: { code: 'TARGET_NOT_FOUND', message: 'Target not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type ReplyCode = typeof REPLY[keyof typeof REPLY]['code']

