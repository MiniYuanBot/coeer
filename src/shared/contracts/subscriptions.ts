import { z } from 'zod'
import type { Group, UserSubscription } from '~/database/schemas'
import { SubscriptionCode, SUBSCRIPTION_TARGET_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const SubscriptionIdSchema = z.object({
    id: z.uuid(),
})

export const ToggleSubscriptionSchema = z.object({
    targetType: z.enum(SUBSCRIPTION_TARGET_TYPE_ARRAY),
    targetId: z.string().min(1),
})

export const ListMySubscriptionsSchema = z.object({
    targetType: z.enum(SUBSCRIPTION_TARGET_TYPE_ARRAY).optional(),
    isActive: z.boolean().optional(),
    ...PaginationSchema.shape,
})

export type SubscriptionIdInput = z.infer<typeof SubscriptionIdSchema>
export type ToggleSubscriptionInput = z.infer<typeof ToggleSubscriptionSchema>
export type ListMySubscriptionsInput = z.infer<typeof ListMySubscriptionsSchema>

export type SubscriptionWithTarget = UserSubscription & {
    target?: Pick<Group, 'id' | 'name' | 'slug'> | { category: string } | null
}

export type SubscriptionResponse<T> = ActionResponse<T, SubscriptionCode>
export type PaginatedSubscriptionResponse<T> = PaginatedActionResponse<T, SubscriptionCode>

