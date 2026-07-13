export const REACTION_TARGET_TYPE = {
    GROUP_POST: 'group_post',
    FEEDBACK: 'feedback',
} as const

export type ReactionTargetType = typeof REACTION_TARGET_TYPE[keyof typeof REACTION_TARGET_TYPE]
export const REACTION_TARGET_TYPE_ARRAY = ['group_post', 'feedback'] as const

export const REACTION = {
    TOGGLE_SUCCESS: { code: 'TOGGLE_SUCCESS', message: 'Toggle successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    NOT_FOUND: { code: 'REACTION_NOT_FOUND', message: 'Reaction not found' } as const,
    TARGET_NOT_FOUND: { code: 'TARGET_NOT_FOUND', message: 'Target not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type ReactionCode = typeof REACTION[keyof typeof REACTION]['code']

