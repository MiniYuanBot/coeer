// server/database/schemas/sessions.ts
import { pgTable, serial, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './users';
import { sql } from 'drizzle-orm';

export const sessions = pgTable('sessions', {
    id: serial('id').primaryKey(),
    sessionId: varchar('session_id', { length: 128 }).notNull().unique(),
    userId: integer('user_id').references(() => users.id).notNull(),
    token: text('token').notNull(), // JWT token
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at'),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 45 }),
    isRevoked: timestamp('revoked_at'),
});

export const sessionsIndexes = {
    sessionIdIdx: sql`CREATE INDEX idx_sessions_session_id ON sessions (session_id)`,
    userIdIdx: sql`CREATE INDEX idx_sessions_user_id ON sessions (user_id)`,
    expiresAtIdx: sql`CREATE INDEX idx_sessions_expires_at ON sessions (expires_at)`,
};

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;