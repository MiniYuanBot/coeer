import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { NewUserSubscription, UserSubscription, userSubscriptions } from '../schemas'
import type { ListMySubscriptionsInput, ToggleSubscriptionInput } from '@shared/contracts'

export const subscriptionQueries = {
    async create(data: NewUserSubscription): Promise<UserSubscription> {
        const [subscription] = await db.insert(userSubscriptions).values(data).returning()
        if (!subscription) throw new Error('Create subscription failed')
        return subscription
    },

    async findByUserAndTarget(userId: string, data: ToggleSubscriptionInput): Promise<UserSubscription | undefined> {
        return db.query.userSubscriptions.findFirst({
            where: and(
                eq(userSubscriptions.userId, userId),
                eq(userSubscriptions.targetType, data.targetType),
                eq(userSubscriptions.targetId, data.targetId),
            ),
        })
    },

    async listByUser(userId: string, data: ListMySubscriptionsInput): Promise<UserSubscription[]> {
        const conditions = [eq(userSubscriptions.userId, userId)]
        if (data.targetType) conditions.push(eq(userSubscriptions.targetType, data.targetType))
        if (data.isActive !== undefined) conditions.push(eq(userSubscriptions.isActive, data.isActive))
        return db.query.userSubscriptions.findMany({
            where: and(...conditions),
            limit: data.limit,
            offset: data.offset,
        })
    },

    async updateStatus(id: string, isActive: boolean): Promise<UserSubscription> {
        const [subscription] = await db.update(userSubscriptions)
            .set({ isActive })
            .where(eq(userSubscriptions.id, id))
            .returning()
        if (!subscription) throw new Error('Subscription not found')
        return subscription
    },
}

