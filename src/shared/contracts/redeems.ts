import { z } from 'zod'
import type { DbUser, RedeemItem, RedeemOrder } from '~/database/schemas'
import { RedeemCode, REDEEM_ITEM_STATUS_ARRAY, REDEEM_ITEM_TYPE_ARRAY, REDEEM_ORDER_STATUS_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const RedeemItemIdSchema = z.object({
    itemId: z.uuid(),
})

export const RedeemOrderIdSchema = z.object({
    orderId: z.uuid(),
})

export const CreateRedeemItemSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    pointsCost: z.number().int().positive(),
    stock: z.number().int().min(-1).default(-1),
    type: z.enum(REDEEM_ITEM_TYPE_ARRAY),
})

export const UpdateRedeemItemSchema = z.object({
    itemId: z.uuid(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    pointsCost: z.number().int().positive().optional(),
    stock: z.number().int().min(-1).optional(),
    type: z.enum(REDEEM_ITEM_TYPE_ARRAY).optional(),
    status: z.enum(REDEEM_ITEM_STATUS_ARRAY).optional(),
})

export const ListRedeemItemsSchema = z.object({
    status: z.enum(REDEEM_ITEM_STATUS_ARRAY).optional(),
    type: z.enum(REDEEM_ITEM_TYPE_ARRAY).optional(),
    search: z.string().optional(),
    ...PaginationSchema.shape,
})

export const RedeemItemSchema = z.object({
    itemId: z.uuid(),
    quantity: z.number().int().min(1).max(10).optional().default(1),
})

export const ListRedeemOrdersSchema = z.object({
    itemId: z.uuid().optional(),
    status: z.enum(REDEEM_ORDER_STATUS_ARRAY).optional(),
    ...PaginationSchema.shape,
})

export const ProcessRedeemOrderSchema = z.object({
    orderId: z.uuid(),
    status: z.enum(REDEEM_ORDER_STATUS_ARRAY),
    redeemCode: z.string().max(100).optional(),
})

export type RedeemItemIdInput = z.infer<typeof RedeemItemIdSchema>
export type RedeemOrderIdInput = z.infer<typeof RedeemOrderIdSchema>
export type CreateRedeemItemInput = z.infer<typeof CreateRedeemItemSchema>
export type UpdateRedeemItemInput = z.infer<typeof UpdateRedeemItemSchema>
export type ListRedeemItemsInput = z.infer<typeof ListRedeemItemsSchema>
export type RedeemItemInput = z.infer<typeof RedeemItemSchema>
export type ListRedeemOrdersInput = z.infer<typeof ListRedeemOrdersSchema>
export type ProcessRedeemOrderInput = z.infer<typeof ProcessRedeemOrderSchema>

export type RedeemOrderWithItem = RedeemOrder & {
    item: RedeemItem
}

export type RedeemOrderWithDetails = RedeemOrder & {
    user: Pick<DbUser, 'id' | 'name'> | null
    item: RedeemItem
}

export type RedeemResponse<T> = ActionResponse<T, RedeemCode>
export type PaginatedRedeemResponse<T> = PaginatedActionResponse<T, RedeemCode>
