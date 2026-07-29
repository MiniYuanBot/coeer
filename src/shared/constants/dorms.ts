export const DORM_CYCLE_STATUS = {
    DRAFT: 'draft',
    COLLECTING: 'collecting',
    COMPUTED: 'computed',
    CONFIRMED: 'confirmed',
    CLOSED: 'closed',
} as const

export type DormCycleStatus = typeof DORM_CYCLE_STATUS[keyof typeof DORM_CYCLE_STATUS]
export const DORM_CYCLE_STATUS_ARRAY = ['draft', 'collecting', 'computed', 'confirmed', 'closed'] as const

export const DORM_ROOM_STATUS = {
    DRAFT: 'draft',
    COMMITTED: 'committed',
    ADJUSTED: 'adjusted',
} as const

export type DormRoomStatus = typeof DORM_ROOM_STATUS[keyof typeof DORM_ROOM_STATUS]
export const DORM_ROOM_STATUS_ARRAY = ['draft', 'committed', 'adjusted'] as const

export const DORM = {
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    COMPUTE_SUCCESS: { code: 'COMPUTE_SUCCESS', message: 'Dorm assignment computed' } as const,
    CONFIRM_SUCCESS: { code: 'CONFIRM_SUCCESS', message: 'Dorm assignment confirmed' } as const,
    NOT_FOUND: { code: 'DORM_NOT_FOUND', message: 'Dorm record not found' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
    WAITING: { code: 'WAITING', message: 'Waiting for final confirmation' } as const,
} as const

export type DormCode = typeof DORM[keyof typeof DORM]['code']
