import { createHash } from 'node:crypto'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { db, type DbTransaction } from '../database/client'
import { pointTransactions } from '../database/schemas'
import { pointQueries } from '../database/queries/points'
import { ENGAGEMENT_REWARDS, engagementDay, type EngagementAction } from '@shared/constants/engagement'
import { AchievementService } from './AchievementService'

function rewardId(userId: string, action: EngagementAction, eventId: string) {
    const digest = createHash('sha256').update(JSON.stringify(['engagement-v1', userId, action, eventId])).digest('hex')
    return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

/** Server-only rewards: the caller must have validated and persisted the action. */
export class EngagementService {
    static async dailyProgress(userId: string, now = new Date()) {
        const { day, start, end } = engagementDay(now)
        const records = await db.select({ source: pointTransactions.source, description: pointTransactions.description, count: count() })
            .from(pointTransactions).where(and(eq(pointTransactions.userId, userId), eq(pointTransactions.type, 'earn'),
                gte(pointTransactions.createdAt, start), lt(pointTransactions.createdAt, end)))
            .groupBy(pointTransactions.source, pointTransactions.description)
        return { day, tasks: Object.entries(ENGAGEMENT_REWARDS).map(([action, rule]) => ({
            action: action as EngagementAction, ...rule,
            completed: Math.min(rule.dailyLimit, records.find(record => record.source === rule.source && record.description === rule.label)?.count ?? 0),
        })) }
    }
    static async recordInTx(userId: string, action: EngagementAction, eventId: string, tx: DbTransaction, now = new Date()) {
        const rule = ENGAGEMENT_REWARDS[action]
        const { start, end } = engagementDay(now)
        // A stable UUID makes retries (including a later day) idempotent without a schema migration.
        const id = rewardId(userId, action, eventId)
        await pointQueries.lockUser(userId, tx)
        const [existing] = await tx.select({ id: pointTransactions.id }).from(pointTransactions).where(eq(pointTransactions.id, id))
        if (!existing) {
            const [today] = await tx.select({ value: count() }).from(pointTransactions).where(and(
                eq(pointTransactions.userId, userId), eq(pointTransactions.type, 'earn'),
                eq(pointTransactions.source, rule.source), eq(pointTransactions.description, rule.label),
                gte(pointTransactions.createdAt, start), lt(pointTransactions.createdAt, end),
            ))
            if (today.value < rule.dailyLimit) {
                await tx.insert(pointTransactions).values({
                    id, userId, source: rule.source, type: 'earn', amount: rule.amount,
                    description: rule.label, createdAt: now,
                }).onConflictDoNothing({ target: pointTransactions.id })
            }
        }
        await AchievementService.syncForUser(userId, tx)
    }

    static async recordDailyVisit(userId: string) {
        const now = new Date()
        const { day } = engagementDay(now)
        const [existing] = await db.select({ id: pointTransactions.id }).from(pointTransactions)
            .where(eq(pointTransactions.id, rewardId(userId, 'daily', day)))
        if (existing) return { day, awarded: false }
        await db.transaction((tx) => this.recordInTx(userId, 'daily', day, tx, now))
        return { day, awarded: true }
    }
}
