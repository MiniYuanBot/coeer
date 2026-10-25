import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { sql } from 'drizzle-orm'

export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 40 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    href: text('href').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index('notifications_user_created_idx').on(table.userId, table.createdAt),
    index('notifications_user_unread_idx').on(table.userId, table.createdAt.desc(), table.id.desc()).where(sql`${table.readAt} IS NULL`),
])

export type Notification = typeof notifications.$inferSelect
