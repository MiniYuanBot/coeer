export const USER_ROLE = {
    STUDENT: 'student',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

export const USER_ROLE_ARRAY = ['student', 'moderator', 'admin'] as const;
