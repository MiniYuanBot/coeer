import { pgTable, varchar, text, timestamp, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users';
import { groups } from './groups';
import { GROUP_POST_TYPE_ARRAY, GroupPostType } from '@shared/constants'

export const postTypeEnum = pgEnum('post_type', GROUP_POST_TYPE_ARRAY);

export const groupPosts = pgTable('group_posts', {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
        .references(() => groups.id, { onDelete: 'cascade' })
        .notNull(),
    authorId: uuid('author_id')
        .references(() => users.id, { onDelete: 'set null' }),
    
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    
    type: postTypeEnum('type').default('discussion').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GroupPost = typeof groupPosts.$inferSelect & { type: GroupPostType };
export type NewGroupPost = typeof groupPosts.$inferInsert & { type: GroupPostType };