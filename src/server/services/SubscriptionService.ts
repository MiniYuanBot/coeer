import { subscriptionQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { SUBSCRIPTION } from '@shared/constants'
import type {
    ListMySubscriptionsInput,
    PaginatedSubscriptionResponse,
    SubscriptionResponse,
    SubscriptionWithTarget,
    ToggleSubscriptionInput,
} from '@shared/contracts'

export class SubscriptionService {
    static async toggle(data: ToggleSubscriptionInput): Promise<SubscriptionResponse<{ subscribed: boolean }>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: SUBSCRIPTION.UNAUTHORIZED }

        const existing = await subscriptionQueries.findByUserAndTarget(user.id, data)
        if (existing) {
            const updated = await subscriptionQueries.updateStatus(existing.id, !existing.isActive)
            return {
                success: true,
                data: { subscribed: updated.isActive },
                state: updated.isActive ? SUBSCRIPTION.SUBSCRIBE_SUCCESS : SUBSCRIPTION.UNSUBSCRIBE_SUCCESS,
            }
        }

        await subscriptionQueries.create({ ...data, userId: user.id, isActive: true })
        return { success: true, data: { subscribed: true }, state: SUBSCRIPTION.SUBSCRIBE_SUCCESS }
    }

    static async listMine(data: ListMySubscriptionsInput): Promise<PaginatedSubscriptionResponse<SubscriptionWithTarget>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: SUBSCRIPTION.UNAUTHORIZED }
        const items = await subscriptionQueries.listByUser(user.id, data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: SUBSCRIPTION.GET_SUCCESS }
    }
}

