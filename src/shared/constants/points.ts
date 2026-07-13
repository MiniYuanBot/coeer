export const POINT_TRANSACTION_TYPE = {
    EARN: 'earn',
    SPEND: 'spend',
} as const

export type PointTransactionType = typeof POINT_TRANSACTION_TYPE[keyof typeof POINT_TRANSACTION_TYPE]
export const POINT_TRANSACTION_TYPE_ARRAY = ['earn', 'spend'] as const

export const POINT_SOURCE = {
    DAILY_LOGIN: 'daily_login',
    FEEDBACK: 'feedback',
    GROUP_POST: 'group_post',
    ACTIVITY: 'activity',
    CREATE_GROUP: 'create_group',
    DRAW: 'draw',
    REDEEM: 'redeem',
    ADJUSTMENT: 'adjustment',
} as const

export type PointSource = typeof POINT_SOURCE[keyof typeof POINT_SOURCE]
export const POINT_SOURCE_ARRAY = ['daily_login', 'feedback', 'group_post', 'activity', 'create_group', 'draw', 'redeem', 'adjustment'] as const

export const POINT = {
    EARN_SUCCESS: { code: 'EARN_SUCCESS', message: 'Earn successful' } as const,
    SPEND_SUCCESS: { code: 'SPEND_SUCCESS', message: 'Spend successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    INSUFFICIENT: { code: 'INSUFFICIENT_POINTS', message: 'Insufficient points' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type PointCode = typeof POINT[keyof typeof POINT]['code']

