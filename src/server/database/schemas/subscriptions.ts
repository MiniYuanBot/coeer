import { boolean, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { SUBSCRIPTION_TARGET_TYPE_ARRAY, SubscriptionTargetType } from '@shared/constants'

export const subscriptionTargetTypeEnum = pgEnum('subscription_target_type', SUBSCRIPTION_TARGET_TYPE_ARRAY)

export const userSubscriptions = pgTable('user_subscriptions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    targetType: subscriptionTargetTypeEnum('target_type').notNull(),
    targetId: varchar('target_id', { length: 100 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('subscriptions_user_target_unique').on(table.userId, table.targetType, table.targetId),
])

export type UserSubscription = typeof userSubscriptions.$inferSelect & { targetType: SubscriptionTargetType }
export type NewUserSubscription = typeof userSubscriptions.$inferInsert & { targetType: SubscriptionTargetType }

