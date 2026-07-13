import { createServerFn } from '@tanstack/react-start'
import { ListMySubscriptionsSchema, ToggleSubscriptionSchema } from '@shared/contracts'
import { SubscriptionService } from '../services'

export const toggleSubscriptionFn = createServerFn({ method: 'POST' })
    .inputValidator(ToggleSubscriptionSchema)
    .handler(async ({ data }) => SubscriptionService.toggle(data))

export const getMySubscriptionsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListMySubscriptionsSchema)
    .handler(async ({ data }) => SubscriptionService.listMine(data))

