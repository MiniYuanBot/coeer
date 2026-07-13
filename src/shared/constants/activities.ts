export const ACTIVITY_TYPE = {
    OFFICIAL: 'official',
    GROUP: 'group',
} as const

export type ActivityType = typeof ACTIVITY_TYPE[keyof typeof ACTIVITY_TYPE]
export const ACTIVITY_TYPE_ARRAY = ['official', 'group'] as const

export const ORGANIZER_TYPE = {
    USER: 'user',
    GROUP: 'group',
} as const

export type OrganizerType = typeof ORGANIZER_TYPE[keyof typeof ORGANIZER_TYPE]
export const ORGANIZER_TYPE_ARRAY = ['user', 'group'] as const

export const ACTIVITY_STATUS = {
    UPCOMING: 'upcoming',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const

export type ActivityStatus = typeof ACTIVITY_STATUS[keyof typeof ACTIVITY_STATUS]
export const ACTIVITY_STATUS_ARRAY = ['upcoming', 'ongoing', 'completed', 'cancelled'] as const

export const PARTICIPANT_STATUS = {
    REGISTERED: 'registered',
    ATTENDED: 'attended',
    CANCELLED: 'cancelled',
} as const

export type ParticipantStatus = typeof PARTICIPANT_STATUS[keyof typeof PARTICIPANT_STATUS]
export const PARTICIPANT_STATUS_ARRAY = ['registered', 'attended', 'cancelled'] as const

export const ACTIVITY = {
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    REGISTER_SUCCESS: { code: 'REGISTER_SUCCESS', message: 'Register successful' } as const,
    CANCEL_SUCCESS: { code: 'CANCEL_SUCCESS', message: 'Cancel successful' } as const,
    CHECK_IN_SUCCESS: { code: 'CHECK_IN_SUCCESS', message: 'Check in successful' } as const,
    NOT_FOUND: { code: 'ACTIVITY_NOT_FOUND', message: 'Activity not found' } as const,
    ALREADY_REGISTERED: { code: 'ALREADY_REGISTERED', message: 'Already registered' } as const,
    FULL: { code: 'ACTIVITY_FULL', message: 'Activity is full' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type ActivityCode = typeof ACTIVITY[keyof typeof ACTIVITY]['code']

