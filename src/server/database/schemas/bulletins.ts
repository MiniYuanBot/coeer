import { boolean, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { BULLETIN_SOURCE_TYPE_ARRAY, BULLETIN_TYPE_ARRAY, BulletinSourceType, BulletinType } from '@shared/constants'

export const bulletinTypeEnum = pgEnum('bulletin_type', BULLETIN_TYPE_ARRAY)
export const bulletinSourceTypeEnum = pgEnum('bulletin_source_type', BULLETIN_SOURCE_TYPE_ARRAY)

export const bulletins = pgTable('bulletins', {
    id: uuid('id').defaultRandom().primaryKey(),
    type: bulletinTypeEnum('type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    sourceId: uuid('source_id'),
    sourceType: bulletinSourceTypeEnum('source_type'),
    isPinned: boolean('is_pinned').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Bulletin = typeof bulletins.$inferSelect & { type: BulletinType, sourceType: BulletinSourceType | null }
export type NewBulletin = typeof bulletins.$inferInsert & { type: BulletinType, sourceType?: BulletinSourceType }

