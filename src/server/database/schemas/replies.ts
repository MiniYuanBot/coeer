import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { REPLY_TARGET_TYPE_ARRAY, ReplyTargetType } from '@shared/constants'

export const replyTargetTypeEnum = pgEnum('reply_target_type', REPLY_TARGET_TYPE_ARRAY)

export const replies = pgTable('replies', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    targetType: replyTargetTypeEnum('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    parentId: uuid('parent_id'),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Reply = typeof replies.$inferSelect & { targetType: ReplyTargetType }
export type NewReply = typeof replies.$inferInsert & { targetType: ReplyTargetType }

