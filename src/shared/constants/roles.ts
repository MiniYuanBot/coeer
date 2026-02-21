export const USER_ROLES = {
    STUDENT: 'student',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ROLES_ARRAY = ['student', 'moderator', 'admin'] as const;