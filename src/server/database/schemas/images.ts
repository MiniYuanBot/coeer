import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

// Database storage survives application releases and is included in existing database backups.
export const uploadedImages = pgTable('uploaded_images', {
    id: uuid('id').defaultRandom().primaryKey(),
    mimeType: varchar('mime_type', { length: 30 }).notNull(),
    data: text('data').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
