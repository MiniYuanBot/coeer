export const CARD_RARITY = {
    COMMON: 'common',
    RARE: 'rare',
    LEGENDARY: 'legendary',
} as const

export type CardRarity = typeof CARD_RARITY[keyof typeof CARD_RARITY]
export const CARD_RARITY_ARRAY = ['common', 'rare', 'legendary'] as const

export const CARD = {
    DRAW_SUCCESS: { code: 'DRAW_SUCCESS', message: 'Draw successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    NOT_FOUND: { code: 'CARD_NOT_FOUND', message: 'Card not found' } as const,
    EMPTY_POOL: { code: 'EMPTY_POOL', message: '奖池暂时为空，请稍后再试' } as const,
    INSUFFICIENT_POINTS: { code: 'INSUFFICIENT_POINTS', message: '积分不足' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type CardCode = typeof CARD[keyof typeof CARD]['code']

