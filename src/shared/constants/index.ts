export const USER_ROLES = {
    STUDENT: 'student',
    MODERATOR: 'moderator',
    ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const USER_ROLES_ARRAY = ['student', 'moderator', 'admin'] as const;

export const FEEDBACK_TARGET_TYPES = {
    ACADEMIC: 'academic',
    OFFICE: 'office',
    GENERAL: 'general'
} as const;

export type FeedbackTargetTypes = typeof FEEDBACK_TARGET_TYPES[keyof typeof FEEDBACK_TARGET_TYPES];

export const FEEDBACK_TARGET_TYPES_ARRAY = ['academic', 'office', 'general'] as const;

export const FEEDBACK_STATUSES = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    RESOLVED: 'resolved',
    INVALID: 'invalid',
} as const;

export type FeedbackStatuses = typeof FEEDBACK_STATUSES[keyof typeof FEEDBACK_STATUSES];

export const FEEDBACK_STATUSES_ARRAY = ['pending', 'processing', 'resolved', 'invalid'] as const;

