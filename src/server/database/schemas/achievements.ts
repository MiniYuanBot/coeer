import { integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { ACHIEVEMENT_CONDITION_TYPE_ARRAY, AchievementConditionType } from '@shared/constants'

export const achievementConditionTypeEnum = pgEnum('achievement_condition_type', ACHIEVEMENT_CONDITION_TYPE_ARRAY)

export const achievements = pgTable('achievements', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    iconUrl: text('icon_url'),
    conditionType: achievementConditionTypeEnum('condition_type').notNull(),
    conditionValue: integer('condition_value').notNull(),
})

export const userAchievements = pgTable('user_achievements', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    achievementId: uuid('achievement_id').references(() => achievements.id, { onDelete: 'cascade' }).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    uniqueIndex('user_achievements_user_achievement_unique').on(table.userId, table.achievementId),
])

export type Achievement = typeof achievements.$inferSelect & { conditionType: AchievementConditionType }
export type NewAchievement = typeof achievements.$inferInsert & { conditionType: AchievementConditionType }
export type UserAchievement = typeof userAchievements.$inferSelect
export type NewUserAchievement = typeof userAchievements.$inferInsert

