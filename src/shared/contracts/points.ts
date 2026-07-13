import { z } from 'zod'
import type { PointTransaction } from '~/database/schemas'
import { PointCode, POINT_SOURCE_ARRAY, POINT_TRANSACTION_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const PointChangeSchema = z.object({
    userId: z.uuid(),
    amount: z.number().int().positive(),
    source: z.enum(POINT_SOURCE_ARRAY),
    description: z.string().max(200).optional(),
})

export const PointHistorySchema = z.object({
    userId: z.uuid().optional(),
    type: z.enum(POINT_TRANSACTION_TYPE_ARRAY).optional(),
    source: z.enum(POINT_SOURCE_ARRAY).optional(),
    ...PaginationSchema.shape,
})

export type PointChangeInput = z.infer<typeof PointChangeSchema>
export type PointHistoryInput = z.infer<typeof PointHistorySchema>

export type PointStats = {
    totalEarned: number
    totalSpent: number
}

export type PointResponse<T> = ActionResponse<T, PointCode>
export type PaginatedPointResponse<T> = PaginatedActionResponse<PointTransaction, PointCode>

