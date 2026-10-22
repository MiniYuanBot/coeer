import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const notifications = pgTable('notifications', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 40 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    href: text('href').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('notifications_user_created_idx').on(table.userId, table.createdAt)])

export type Notification = typeof notifications.$inferSelect
