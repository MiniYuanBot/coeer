import { and, eq, ilike, or, SQL } from 'drizzle-orm'
import { db } from '../client'
import { achievements, NewAchievement, userAchievements } from '../schemas'
import type { AchievementIdInput, ListAchievementsInput, UpdateAchievementInput } from '@shared/contracts'

function buildAchievementWhere(data: ListAchievementsInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.conditionType) conditions.push(eq(achievements.conditionType, data.conditionType))
    if (data.search) {
        const searchCondition = or(
            ilike(achievements.name, `%${data.search}%`),
            ilike(achievements.description, `%${data.search}%`),
            ilike(achievements.code, `%${data.search}%`)
        )
        if (searchCondition) conditions.push(searchCondition)
    }
    return conditions.length ? and(...conditions) : undefined
}

export const achievementQueries = {
    async create(data: NewAchievement) {
        const [achievement] = await db.insert(achievements).values(data).returning()
        if (!achievement) throw new Error('Create achievement failed')
        return achievement
    },

    async list(data: ListAchievementsInput) {
        return db.query.achievements.findMany({
            where: buildAchievementWhere(data),
            limit: data.limit,
            offset: data.offset,
        })
    },

    async update(data: UpdateAchievementInput) {
        const [achievement] = await db.update(achievements)
            .set(data)
            .where(eq(achievements.id, data.achievementId))
            .returning()
        if (!achievement) throw new Error('Achievement not found')
        return achievement
    },

    async delete(data: AchievementIdInput): Promise<void> {
        await db.delete(achievements).where(eq(achievements.id, data.achievementId))
    },

    async listByUser(userId: string, limit = 20, offset = 0) {
        return db.query.userAchievements.findMany({
            where: eq(userAchievements.userId, userId),
            with: { achievement: true },
            limit,
            offset,
        })
    },

    async unlock(userId: string, achievementId: string) {
        const [record] = await db.insert(userAchievements).values({ userId, achievementId }).returning()
        return record
    },
}
