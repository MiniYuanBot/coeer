export const ACHIEVEMENT_CONDITION_TYPE = {
    COUNT: 'count',
    ACTION: 'action',
    LEVEL: 'level',
} as const

export type AchievementConditionType = typeof ACHIEVEMENT_CONDITION_TYPE[keyof typeof ACHIEVEMENT_CONDITION_TYPE]
export const ACHIEVEMENT_CONDITION_TYPE_ARRAY = ['count', 'action', 'level'] as const

export const ACHIEVEMENT = {
    UNLOCK_SUCCESS: { code: 'UNLOCK_SUCCESS', message: 'Unlock successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    NOT_FOUND: { code: 'ACHIEVEMENT_NOT_FOUND', message: 'Achievement not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type AchievementCode = typeof ACHIEVEMENT[keyof typeof ACHIEVEMENT]['code']
