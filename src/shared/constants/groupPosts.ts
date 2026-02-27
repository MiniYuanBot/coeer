export const GROUP_POST_TYPE = {
    ANNOUNCEMENT: 'announcement',
    DISCUSSION: 'discussion',
} as const;

export type GroupPostType = typeof GROUP_POST_TYPE[keyof typeof GROUP_POST_TYPE];
export const GROUP_POST_TYPE_ARRAY = ['announcement', 'discussion'] as const;

export const GROUP_POST = {
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    PIN_SUCCESS: { code: 'PIN_SUCCESS', message: 'Pin successful' } as const,
    UNPIN_SUCCESS: { code: 'UNPIN_SUCCESS', message: 'Unpin successful' } as const,
    // LEAVE_SUCCESS: { code: 'LEAVE_SUCCESS', message: 'Leave successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    // APPROVE_SUCCESS: { code: 'APPROVE_SUCCESS', message: 'Approve successful' } as const,
    
    GROUP_NOT_FOUND: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } as const,
    NOT_FOUND: { code: 'MEMBER_NOT_FOUND', message: 'Group post not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    PIN_LIMIT_REACHED: { code: 'PIN_LIMIT_REACHED', message: 'Maxium pinned post limit reached' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type GroupPostCode = typeof GROUP_POST[keyof typeof GROUP_POST]['code'];
export type GroupPostState = {
    code: GroupPostCode;
    message: string;
};