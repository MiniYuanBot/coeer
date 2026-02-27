import { pgTable, varchar, text, timestamp, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core'
import { USER_ROLE_ARRAY, UserRole } from '@shared/constants';

export const userRoleEnum = pgEnum('user_role', USER_ROLE_ARRAY);

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 63 }),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').notNull().default('student'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    // avatarUrl: text('avatar_url'),
    // points: integer('points').notNull().default(0),
})

export const userProfiles = pgTable('user_profiles', {
    userId: uuid('user_id').references(() => users.id).primaryKey(),
    bio: text('bio'),
    // privacySettings: json('privacy_settings').$type<{
    //     showEmail?: boolean;
    //     showStudentId?: boolean;
    //     showProfile?: boolean;
    // }>().default({ showProfile: true }),
    // achievementsCount: integer('achievements_count').notNull().default(0),
    // cardsCount: integer('cards_count').notNull().default(0)
});

export type DbUser = typeof users.$inferSelect & { role: UserRole }
export type NewDbUser = typeof users.$inferInsert & { role: UserRole }
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;