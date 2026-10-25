import { achievementQueries } from '../database/queries'
import { ACHIEVEMENT, resolveAchievementCondition } from '@shared/constants'
import { CreateAchievementSchema } from '@shared/contracts/achievements'
import { AuthService } from './AuthService'
import type {
    AchievementResponse,
    AchievementWithProgress,
    AchievementIdInput,
    CreateAchievementInput,
    ListAchievementsInput,
    PaginatedAchievementResponse,
    UpdateAchievementInput,
    UserAchievementWithAchievement,
} from '@shared/contracts'
import type { Achievement } from '../database/schemas'
import { achievements, feedbacks, groups, groupMembers, pointTransactions, userCards } from '../database/schemas'
import { db, type DbTransaction } from '../database/client'
import { pointQueries } from '../database/queries/points'
import { and, count, countDistinct, eq, gt, ne, or, sql, sum } from 'drizzle-orm'

export class AchievementService {
    static async adminList(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<Achievement>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (current.data.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const [items, total] = await Promise.all([achievementQueries.list(data), achievementQueries.count(data)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
    }

    static async adminGet(data: AchievementIdInput): Promise<AchievementResponse<Achievement>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (current.data.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const achievement = await achievementQueries.findById(data.achievementId)
        if (!achievement) return { success: false, state: ACHIEVEMENT.NOT_FOUND }
        return { success: true, data: achievement, state: ACHIEVEMENT.GET_SUCCESS }
    }

    /** Reconcile real persisted conditions, including users who qualified before this feature existed. */
    static async syncForUser(userId: string, executor?: DbTransaction): Promise<Record<string, number>> {
        if (!executor) return db.transaction((tx) => this.syncForUser(userId, tx))
        await pointQueries.lockUser(userId, executor)
        const definitions = await executor.select().from(achievements)
        if (!definitions.length) return {}
        const [feedbackCount] = await executor.select({ value: count() }).from(feedbacks).where(eq(feedbacks.authorId, userId))
        const [groupCount] = await executor.select({ value: countDistinct(groups.id) }).from(groups)
            .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId),
                eq(groupMembers.role, 'admin'), eq(groupMembers.status, 'approved')))
            .where(and(ne(groups.status, 'rejected'), or(eq(groups.creatorId, userId), eq(groupMembers.userId, userId))))
        const [cardCount] = await executor.select({ value: countDistinct(userCards.cardId) }).from(userCards)
            .where(and(eq(userCards.userId, userId), gt(userCards.count, 0)))
        const [loginDays] = await executor.select({ value: countDistinct(sql`(${pointTransactions.createdAt} AT TIME ZONE 'Asia/Shanghai')::date`) })
            .from(pointTransactions).where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.source, 'daily_login'), eq(pointTransactions.type, 'earn')))
        const [earned] = await executor.select({ value: sum(pointTransactions.amount) }).from(pointTransactions)
            .where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.type, 'earn'), gt(pointTransactions.amount, 0)))
        const values: Record<string, number> = {
            registration: 1, login_days: loginDays.value, points_earned: Number(earned.value ?? 0),
            feedback_count: feedbackCount.value, group_count: groupCount.value, card_count: cardCount.value,
        }
        for (const achievement of definitions) {
            const condition = resolveAchievementCondition(achievement.conditionType, achievement.code)
            const current = condition ? values[condition] : undefined
            if (current !== undefined && current >= achievement.conditionValue) {
                await achievementQueries.unlock(userId, achievement.id, executor)
            }
        }
        return values
    }

    static async list(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<AchievementWithProgress>> {
        const current = await AuthService.getCurrentUser()
        const values = current.data ? await this.syncForUser(current.data.id) : {}
        const viewer = { id: current.success ? current.data?.id : undefined }
        const [items, total] = await Promise.all([achievementQueries.list(data, viewer), achievementQueries.count(data, viewer)])
        const unlocked = current.data ? await db.query.userAchievements.findMany({
            where: (table, { and, eq, inArray }) => and(eq(table.userId, current.data!.id), inArray(table.achievementId, items.map((item) => item.id))),
        }) : []
        const unlockedIds = new Set(unlocked.map((item) => item.achievementId))
        return { success: true, data: { items: items.map((item) => {
            const condition = resolveAchievementCondition(item.conditionType, item.code)
            const value = condition ? values[condition] : undefined
            return { ...item, unlocked: unlockedIds.has(item.id), progress: value === undefined ? undefined : {
                current: value, target: item.conditionValue, percentage: Math.min(100, value / item.conditionValue * 100),
            } }
        }), total, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
    }

    static async listMine(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<UserAchievementWithAchievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        await this.syncForUser(user.id)
        const [items, total] = await Promise.all([achievementQueries.listByUser(user.id, data), achievementQueries.countByUser(user.id, data)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
    }

    static async adminCreate(data: CreateAchievementInput): Promise<AchievementResponse<Achievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const parsed = CreateAchievementSchema.safeParse(data)
        if (!parsed.success) return { success: false, state: ACHIEVEMENT.INVALID_INPUT }
        try {
            const achievement = await achievementQueries.create(parsed.data)
            return { success: true, data: achievement, state: ACHIEVEMENT.CREATE_SUCCESS }
        } catch (error) {
            if (isDuplicateCode(error)) return { success: false, state: ACHIEVEMENT.ALREADY_EXISTS }
            throw error
        }
    }

    static async adminUpdate(data: UpdateAchievementInput): Promise<AchievementResponse<Achievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const existing = await db.query.achievements.findFirst({ where: eq(achievements.id, data.achievementId) })
        if (!existing) return { success: false, state: ACHIEVEMENT.NOT_FOUND }
        const parsed = CreateAchievementSchema.safeParse({ ...existing, ...data })
        if (!parsed.success) return { success: false, state: ACHIEVEMENT.INVALID_INPUT }
        try {
            const achievement = await achievementQueries.update({ ...parsed.data, achievementId: data.achievementId })
            return { success: true, data: achievement, state: ACHIEVEMENT.UPDATE_SUCCESS }
        } catch (error) {
            if (isDuplicateCode(error)) return { success: false, state: ACHIEVEMENT.ALREADY_EXISTS }
            throw error
        }
    }

    static async adminDelete(data: AchievementIdInput): Promise<AchievementResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        await achievementQueries.delete(data)
        return { success: true, state: ACHIEVEMENT.DELETE_SUCCESS }
    }
}

function isDuplicateCode(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    if ('code' in error && error.code === '23505') return true
    return 'cause' in error && isDuplicateCode(error.cause)
}
