export const SUBSCRIPTION_TARGET_TYPE = {
    GROUP: 'group',
    CATEGORY: 'category',
} as const

export type SubscriptionTargetType = typeof SUBSCRIPTION_TARGET_TYPE[keyof typeof SUBSCRIPTION_TARGET_TYPE]
export const SUBSCRIPTION_TARGET_TYPE_ARRAY = ['group', 'category'] as const

export const SUBSCRIPTION = {
    SUBSCRIBE_SUCCESS: { code: 'SUBSCRIBE_SUCCESS', message: 'Subscribe successful' } as const,
    UNSUBSCRIBE_SUCCESS: { code: 'UNSUBSCRIBE_SUCCESS', message: 'Unsubscribe successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    NOT_FOUND: { code: 'SUBSCRIPTION_NOT_FOUND', message: 'Subscription not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type SubscriptionCode = typeof SUBSCRIPTION[keyof typeof SUBSCRIPTION]['code']

