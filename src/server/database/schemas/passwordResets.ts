import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const passwordResets = pgTable('password_resets', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    emailHash: varchar('email_hash', { length: 64 }).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    passwordVersion: varchar('password_version', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
}, (table) => [index('password_resets_email_created_idx').on(table.emailHash, table.createdAt)])
