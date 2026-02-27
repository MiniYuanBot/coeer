import { pgTable, varchar, text, timestamp, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'
import { GROUP_CATEGORY_ARRAY, GroupCategory, GROUP_STATUS_ARRAY, GroupStatus } from '@shared/constants'

export const groupCategoryEnum = pgEnum('group_category', GROUP_CATEGORY_ARRAY)
export const groupStatusEnum = pgEnum('group_status', GROUP_STATUS_ARRAY)

export const groups = pgTable('groups', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    // URL-friendly identifier
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    description: text('description'),
    // avatarUrl: text('avatar_url'),
    category: groupCategoryEnum('category').notNull(),
    creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
    status: groupStatusEnum('status').notNull().default('pending'),
    isPublic: boolean('is_public').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    rejectedReason: text('rejected_reason'),
})

export type Group = typeof groups.$inferSelect & { category: GroupCategory, status: GroupStatus }
export type NewGroup = typeof groups.$inferInsert & { category: GroupCategory, status: GroupStatus }