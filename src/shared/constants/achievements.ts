export const ACHIEVEMENT_CONDITION_TYPE = {
    COUNT: 'count',
    ACTION: 'action',
    LEVEL: 'level',
    REGISTRATION: 'registration',
    LOGIN_DAYS: 'login_days',
    POINTS_EARNED: 'points_earned',
    FEEDBACK_COUNT: 'feedback_count',
    GROUP_COUNT: 'group_count',
    CARD_COUNT: 'card_count',
} as const

export type AchievementConditionType = typeof ACHIEVEMENT_CONDITION_TYPE[keyof typeof ACHIEVEMENT_CONDITION_TYPE]
export const CONFIGURABLE_ACHIEVEMENT_CONDITIONS = ['registration', 'login_days', 'points_earned', 'feedback_count', 'group_count', 'card_count'] as const
export const ACHIEVEMENT_CONDITION_TYPE_ARRAY = ['count', 'action', 'level', ...CONFIGURABLE_ACHIEVEMENT_CONDITIONS] as const
export type ConfigurableAchievementCondition = typeof CONFIGURABLE_ACHIEVEMENT_CONDITIONS[number]

/** Keep the original seeded definitions working; new rules depend on their condition, never their code. */
export function resolveAchievementCondition(type: AchievementConditionType, code: string): ConfigurableAchievementCondition | undefined {
    if ((CONFIGURABLE_ACHIEVEMENT_CONDITIONS as readonly string[]).includes(type)) return type as ConfigurableAchievementCondition
    const legacy: Record<string, ConfigurableAchievementCondition> = {
        FIRST_FEEDBACK: 'feedback_count', GROUP_STARTER: 'group_count', CARD_COLLECTOR: 'card_count',
    }
    return Object.hasOwn(legacy, code) ? legacy[code] : undefined
}

export const ACHIEVEMENT = {
    UNLOCK_SUCCESS: { code: 'UNLOCK_SUCCESS', message: 'Unlock successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    NOT_FOUND: { code: 'ACHIEVEMENT_NOT_FOUND', message: 'Achievement not found' } as const,
    INVALID_INPUT: { code: 'INVALID_INPUT', message: '请选择有效的解锁条件；注册即得的条件数值必须为 1' } as const,
    ALREADY_EXISTS: { code: 'ALREADY_EXISTS', message: '成就代码已存在，请使用其他代码' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type AchievementCode = typeof ACHIEVEMENT[keyof typeof ACHIEVEMENT]['code']
