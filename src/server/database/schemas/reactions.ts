import { pgEnum, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { REACTION_TARGET_TYPE_ARRAY, ReactionTargetType } from '@shared/constants'

export const reactionTargetTypeEnum = pgEnum('reaction_target_type', REACTION_TARGET_TYPE_ARRAY)

export const reactions = pgTable('reactions', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    targetType: reactionTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('reactions_user_target_unique').on(table.userId, table.targetType, table.targetId),
])

export type Reaction = typeof reactions.$inferSelect & { targetType: ReactionTargetType }
export type NewReaction = typeof reactions.$inferInsert & { targetType: ReactionTargetType }

