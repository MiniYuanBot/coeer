export const GROUP_CATEGORIES = {
    CLUB: 'club',
    PROJECT: 'project',
    INTEREST: 'interest',
    COURSE: 'course',
    ORGANIZATION: 'organizatino',
} as const;

export type GroupCategories = typeof GROUP_CATEGORIES[keyof typeof GROUP_CATEGORIES];

export const GROUP_CATEGORIES_ARRAY = ['club', 'project', 'interest', 'course', 'organizatino'] as const;

export const GROUP_STATUSES = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

export type GroupStatuses = typeof GROUP_STATUSES[keyof typeof GROUP_STATUSES];

export const GROUP_STATUSES_ARRAY = ['pending', 'approved', 'rejected'] as const;

export const GROUP = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    
    ALREADY_EXISTS: { code: 'SLUG_EXISTS', message: 'Slug already exists' } as const,
    NOT_FOUND: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type GroupCode = typeof GROUP[keyof typeof GROUP]['code'];
export type GroupState = {
    code: GroupCode;
    message: string;
};