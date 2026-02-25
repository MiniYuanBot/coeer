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

export const FEEDBACK = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    
    NOT_FOUND: { code: 'FEEDBACK_NOT_FOUND', message: 'Feedback not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type FeedbackCode = typeof FEEDBACK[keyof typeof FEEDBACK]['code'];
export type FeedbackState = {
    code: FeedbackCode;
    message: string;
};