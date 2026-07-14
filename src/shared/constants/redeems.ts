export const REDEEM_ITEM_TYPE = {
    PHYSICAL: 'physical',
    VIRTUAL: 'virtual',
} as const

export type RedeemItemType = typeof REDEEM_ITEM_TYPE[keyof typeof REDEEM_ITEM_TYPE]
export const REDEEM_ITEM_TYPE_ARRAY = ['physical', 'virtual'] as const

export const REDEEM_ITEM_STATUS = {
    ACTIVE: 'active',
    SOLD_OUT: 'sold_out',
    DISCONTINUED: 'discontinued',
} as const

export type RedeemItemStatus = typeof REDEEM_ITEM_STATUS[keyof typeof REDEEM_ITEM_STATUS]
export const REDEEM_ITEM_STATUS_ARRAY = ['active', 'sold_out', 'discontinued'] as const

export const REDEEM_ORDER_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
} as const

export type RedeemOrderStatus = typeof REDEEM_ORDER_STATUS[keyof typeof REDEEM_ORDER_STATUS]
export const REDEEM_ORDER_STATUS_ARRAY = ['pending', 'completed', 'cancelled'] as const

export const REDEEM = {
    ORDER_SUCCESS: { code: 'ORDER_SUCCESS', message: 'Order successful' } as const,
    CANCEL_SUCCESS: { code: 'CANCEL_SUCCESS', message: 'Cancel successful' } as const,
    GET_SUCCESS: { code: 'GET_SUCCESS', message: 'Get successful' } as const,
    CREATE_SUCCESS: { code: 'CREATE_SUCCESS', message: 'Create successful' } as const,
    UPDATE_SUCCESS: { code: 'UPDATE_SUCCESS', message: 'Update successful' } as const,
    DELETE_SUCCESS: { code: 'DELETE_SUCCESS', message: 'Delete successful' } as const,
    ITEM_NOT_FOUND: { code: 'ITEM_NOT_FOUND', message: 'Redeem item not found' } as const,
    ORDER_NOT_FOUND: { code: 'ORDER_NOT_FOUND', message: 'Redeem order not found' } as const,
    OUT_OF_STOCK: { code: 'OUT_OF_STOCK', message: 'Out of stock' } as const,
    INSUFFICIENT_POINTS: { code: 'INSUFFICIENT_POINTS', message: 'Insufficient points' } as const,
    UNAUTHORIZED: { code: 'UNAUTHORIZED', message: 'Unauthorized user' } as const,
    FORBIDDEN: { code: 'FORBIDDEN', message: 'You do not have permission' } as const,
    SERVER_ERROR: { code: 'SERVER_ERROR', message: 'Server error, please try again' } as const,
} as const

export type RedeemCode = typeof REDEEM[keyof typeof REDEEM]['code']
