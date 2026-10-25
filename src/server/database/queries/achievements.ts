import { and, asc, count, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { achievements, NewAchievement, userAchievements } from '../schemas'
import type { AchievementIdInput, ListAchievementsInput, UpdateAchievementInput } from '@shared/contracts'

function buildAchievementWhere(data: ListAchievementsInput, viewer?: { id?: string }): SQL | undefined {
    const conditions: SQL[] = []
    if (data.isHidden !== undefined) conditions.push(eq(achievements.isHidden, data.isHidden))
    if (viewer) conditions.push(or(eq(achievements.isHidden, false), viewer.id ? inArray(achievements.id,
        db.select({ id: userAchievements.achievementId }).from(userAchievements).where(eq(userAchievements.userId, viewer.id))) : undefined)!)
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
    async findById(achievementId: string) {
        return db.query.achievements.findFirst({ where: eq(achievements.id, achievementId) })
    },
    async count(data: ListAchievementsInput, viewer?: { id?: string }) {
        const [result] = await db.select({ value: count() }).from(achievements).where(buildAchievementWhere(data, viewer))
        return result.value
    },
    async create(data: NewAchievement) {
        const [achievement] = await db.insert(achievements).values(data).returning()
        if (!achievement) throw new Error('Create achievement failed')
        return achievement
    },

    async list(data: ListAchievementsInput, viewer?: { id?: string }) {
        return db.query.achievements.findMany({
            where: buildAchievementWhere(data, viewer),
            orderBy: [asc(achievements.code), asc(achievements.id)],
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

    async listByUser(userId: string, data: ListAchievementsInput) {
        return db.query.userAchievements.findMany({
            where: and(eq(userAchievements.userId, userId), inArray(userAchievements.achievementId,
                db.select({ id: achievements.id }).from(achievements).where(buildAchievementWhere(data)))),
            with: { achievement: true },
            orderBy: [desc(userAchievements.unlockedAt), desc(userAchievements.id)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async countByUser(userId: string, data: ListAchievementsInput) {
        const [result] = await db.select({ value: count() }).from(userAchievements).where(and(eq(userAchievements.userId, userId),
            inArray(userAchievements.achievementId, db.select({ id: achievements.id }).from(achievements).where(buildAchievementWhere(data)))))
        return result.value
    },

    async unlock(userId: string, achievementId: string, executor: DbExecutor = db) {
        const [record] = await executor.insert(userAchievements).values({ userId, achievementId })
            .onConflictDoNothing({ target: [userAchievements.userId, userAchievements.achievementId] }).returning()
        return record
    },
}
