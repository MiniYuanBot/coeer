export const GROUP_CATEGORY = {
    CLUB: 'club',
    PROJECT: 'project',
    INTEREST: 'interest',
    COURSE: 'course',
    ORGANIZATION: 'organization',
} as const;

export type GroupCategory = typeof GROUP_CATEGORY[keyof typeof GROUP_CATEGORY];

export const GROUP_CATEGORY_ARRAY = ['club', 'project', 'interest', 'course', 'organization'] as const;

export const GROUP_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

export type GroupStatus = typeof GROUP_STATUS[keyof typeof GROUP_STATUS];

export const GROUP_STATUS_ARRAY = ['pending', 'approved', 'rejected'] as const;

export const GROUP = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    APPROVE_SUCCESS: { code: 'APPROVE_SUCCESS', message: 'Approve successful' } as const,
    REJECT_SUCCESS: { code: 'REJECT_SUCCESS', message: 'Reject successful' } as const,
    
    ALREADY_EXISTS: { code: 'SLUG_EXISTS', message: 'Slug already exists' } as const,
    NOT_FOUND: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    INVALID_STATUS: { code: 'INVALID_STATUS', message: 'Group status is wrong' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type GroupCode = typeof GROUP[keyof typeof GROUP]['code'];
export type GroupState = {
    code: GroupCode;
    message: string;
};