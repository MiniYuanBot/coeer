export const BULLETIN_TYPE = {
    FEEDBACK_RESPONSE: 'feedback_response',
    GROUP_ANNOUNCEMENT: 'group_announcement',
    ACTIVITY: 'activity',
    OFFICIAL: 'official',
    HOT: 'hot',
} as const

export type BulletinType = typeof BULLETIN_TYPE[keyof typeof BULLETIN_TYPE]
export const BULLETIN_TYPE_ARRAY = ['feedback_response', 'group_announcement', 'activity', 'official', 'hot'] as const

export const BULLETIN_SOURCE_TYPE = {
    FEEDBACK: 'feedback',
    GROUP_POST: 'group_post',
    ACTIVITY: 'activity',
} as const

export type BulletinSourceType = typeof BULLETIN_SOURCE_TYPE[keyof typeof BULLETIN_SOURCE_TYPE]
export const BULLETIN_SOURCE_TYPE_ARRAY = ['feedback', 'group_post', 'activity'] as const

export const BULLETIN = {
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    NOT_FOUND: { code: 'BULLETIN_NOT_FOUND', message: 'Bulletin not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type BulletinCode = typeof BULLETIN[keyof typeof BULLETIN]['code']

