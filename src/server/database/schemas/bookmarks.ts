import { index, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groupPosts } from './groupPosts'

export const bookmarks = pgTable('bookmarks', {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    postId: uuid('post_id').notNull().references(() => groupPosts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index('bookmarks_user_created_idx').on(table.userId, table.createdAt),
])
