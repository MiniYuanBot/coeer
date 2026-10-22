import { achievementQueries } from '../database/queries'
import { ACHIEVEMENT } from '@shared/constants'
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
import { achievements, feedbacks, groups, groupMembers, userCards } from '../database/schemas'
import { db, type DbTransaction } from '../database/client'
import { pointQueries } from '../database/queries/points'
import { and, count, countDistinct, eq, gt, ne, or } from 'drizzle-orm'

export class AchievementService {
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
        const values: Record<string, number> = {
            FIRST_FEEDBACK: feedbackCount.value, GROUP_STARTER: groupCount.value, CARD_COLLECTOR: cardCount.value,
        }
        for (const achievement of definitions) {
            const current = values[achievement.code]
            if (current !== undefined && current >= achievement.conditionValue) {
                await achievementQueries.unlock(userId, achievement.id, executor)
            }
        }
        return values
    }

    static async list(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<AchievementWithProgress>> {
        const current = await AuthService.getCurrentUser()
        const values = current.data ? await this.syncForUser(current.data.id) : {}
        const [items, total] = await Promise.all([achievementQueries.list(data), achievementQueries.count(data)])
        const unlocked = current.data ? await db.query.userAchievements.findMany({
            where: (table, { and, eq, inArray }) => and(eq(table.userId, current.data!.id), inArray(table.achievementId, items.map((item) => item.id))),
        }) : []
        const unlockedIds = new Set(unlocked.map((item) => item.achievementId))
        return { success: true, data: { items: items.map((item) => ({ ...item, unlocked: unlockedIds.has(item.id),
            progress: values[item.code] === undefined ? undefined : {
                current: values[item.code], target: item.conditionValue,
                percentage: Math.min(100, values[item.code] / item.conditionValue * 100),
            },
        })), total, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
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
        const achievement = await achievementQueries.create(data)
        return { success: true, data: achievement, state: ACHIEVEMENT.CREATE_SUCCESS }
    }

    static async adminUpdate(data: UpdateAchievementInput): Promise<AchievementResponse<Achievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const achievement = await achievementQueries.update(data)
        return { success: true, data: achievement, state: ACHIEVEMENT.UPDATE_SUCCESS }
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
