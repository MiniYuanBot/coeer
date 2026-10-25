export const GROUP_MEMBER_ROLE = {
    OWNER: 'owner',
    MEMBER: 'member',
    ADMIN: 'admin',
} as const;

export type GroupMemberRole = typeof GROUP_MEMBER_ROLE[keyof typeof GROUP_MEMBER_ROLE];
export const GROUP_MEMBER_ROLE_ARRAY = ['member', 'admin', 'owner'] as const;

export const GROUP_MEMBER_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

export type GroupMemberStatus = typeof GROUP_MEMBER_STATUS[keyof typeof GROUP_MEMBER_STATUS];
export const GROUP_MEMBER_STATUS_ARRAY = ['pending', 'approved', 'rejected'] as const;

export const GROUP_MEMBER = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    JOIN_SUCCESS: { code: 'JOIN_SUCCESS', message: 'Join successful' } as const,
    LEAVE_SUCCESS: { code: 'LEAVE_SUCCESS', message: 'Leave successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    APPROVE_SUCCESS: { code: 'APPROVE_SUCCESS', message: 'Approve successful' } as const,

    GROUP_NOT_FOUND: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } as const,
    NOT_FOUND: { code: 'MEMBER_NOT_FOUND', message: 'Group member not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    OWNER_PROTECTED: { code: 'OWNER_PROTECTED', message: '群主不能被移除或降级，请先将群主身份转让给其他已通过审核的成员' } as const,
    ADMIN_LIMIT: { code: 'ADMIN_LIMIT', message: '每个群组最多 3 名管理员' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: '当前身份无权执行此操作；只有群主可以变更成员身份' } as const,
    INVALID_STATUS: { code: 'INVALID_STATUS', message: 'Already reviewed' } as const,
    ALREADY_EXISTS: { code: 'ALREADY_EXISTS', message: 'Group member already exists' } as const,
    ALREADY_SUBMIT: { code: 'ALREADY_SUBMIT', message: 'Your request is already submited' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const;

export type GroupMemberCode = typeof GROUP_MEMBER[keyof typeof GROUP_MEMBER]['code'];
export type GroupMemberState = {
    code: GroupMemberCode;
    message: string;
};
