import { pointQueries } from '../database/queries'
import { POINT, type PointSource } from '@shared/constants'
import { AuthService } from './AuthService'
import { db, type DbTransaction } from '../database/client'
import type { PaginatedPointResponse, PointChangeInput, PointHistoryInput, PointResponse } from '@shared/contracts'
import type { PointTransaction } from '../database/schemas'
import { AchievementService } from './AchievementService'
import { AdminPointAdjustmentSchema, type AdminPointAdjustmentInput } from '@shared/contracts/points'
import { pointTransactions, users } from '../database/schemas'
import { eq } from 'drizzle-orm'
import { NotificationService } from './NotificationService'

export type SpendOutcome =
    | { ok: true; transaction: PointTransaction }
    | { ok: false; code: 'INSUFFICIENT_POINTS' | 'SERVER_ERROR' }

type PointChangeInternal = Omit<PointChangeInput, 'userId'> & { userId: string; source: PointSource }

export class PointService {
    static async adjust(input: AdminPointAdjustmentInput) {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) throw new Error('请先登录')
        if (current.data.role !== 'admin') throw new Error('只有平台管理员可以调整积分')
        const data = AdminPointAdjustmentSchema.parse(input)
        const actorId = current.data.id
        return db.transaction(async tx => {
            await pointQueries.lockUser(data.userId, tx)
            const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.id, data.userId))
            if (!target) throw new Error('用户不存在')
            const description = `管理员 ${actorId}：${data.reason}`
            const [existing] = await tx.select().from(pointTransactions).where(eq(pointTransactions.id, data.requestId))
            if (existing) {
                if (existing.userId !== data.userId || existing.source !== 'adjustment' || existing.amount !== data.amount || existing.description !== description) throw new Error('请求编号已使用')
                return { balance: await pointQueries.getBalance(data.userId, tx) }
            }
            const balance = await pointQueries.getBalance(data.userId, tx)
            if (balance + data.amount < 0) throw new Error('扣减后积分不能小于零')
            await pointQueries.create({ id: data.requestId, userId: data.userId, amount: data.amount,
                type: data.amount > 0 ? 'earn' : 'spend', source: 'adjustment', description }, tx)
            await AchievementService.syncForUser(data.userId, tx)
            await NotificationService.create({ userId: data.userId, type: 'point_adjustment', title: '积分调整通知',
                content: `你的积分已${data.amount > 0 ? '增加' : '扣减'} ${Math.abs(data.amount)}，原因：${data.reason}。当前余额：${balance + data.amount}。`, href: '/profile' }, tx)
            return { balance: balance + data.amount }
        })
    }
    /**
     * Authorized balance change for an explicit target user.
     * Only used by internal business services (redeem, draw) inside a
     * transaction — never exposed directly as a server function.
     *
     * Serialization: the user row is locked (SELECT … FOR NO KEY UPDATE) so two
     * concurrent spends/draws can not double-spend, and the balance is
     * re-read after the lock.
     */
    static async spendInTx(data: PointChangeInternal, executor: DbTransaction): Promise<SpendOutcome> {
        try {
            await pointQueries.lockUser(data.userId, executor)
            const balance = await pointQueries.getBalance(data.userId, executor)
            if (balance < data.amount) {
                return { ok: false, code: 'INSUFFICIENT_POINTS' }
            }
            const transaction = await pointQueries.create(
                {
                    userId: data.userId,
                    amount: -data.amount,
                    type: 'spend',
                    source: data.source,
                    description: data.description,
                },
                executor,
            )
            return { ok: true, transaction }
        } catch (err) {
            console.error('Spend point error:', err)
            return { ok: false, code: 'SERVER_ERROR' }
        }
    }

    /** Non-transactional public API (kept for future/adjustment flows). */
    static async earn(data: PointChangeInput): Promise<PointResponse<PointTransaction>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: POINT.UNAUTHORIZED }
            if (data.userId !== user.id && user.role !== 'admin') {
                return { success: false, state: POINT.FORBIDDEN }
            }

            const transaction = await db.transaction(async (tx) => {
                await pointQueries.lockUser(data.userId, tx)
                const earned = await pointQueries.create({ ...data, amount: data.amount, type: 'earn' }, tx)
                await AchievementService.syncForUser(data.userId, tx)
                return earned
            })
            return { success: true, data: transaction, state: POINT.EARN_SUCCESS }
        } catch (err) {
            console.error('Earn point error:', err)
            return { success: false, state: POINT.SERVER_ERROR }
        }
    }

    static async spend(data: PointChangeInput): Promise<PointResponse<PointTransaction>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) return { success: false, state: POINT.UNAUTHORIZED }
            if (data.userId !== user.id && user.role !== 'admin') {
                return { success: false, state: POINT.FORBIDDEN }
            }

            const outcome = await db.transaction((tx) => PointService.spendInTx(
                { ...data, source: data.source ?? 'adjustment' },
                tx,
            ))
            if (!outcome.ok) {
                return { success: false, state: outcome.code === 'INSUFFICIENT_POINTS' ? POINT.INSUFFICIENT : POINT.SERVER_ERROR }
            }
            return { success: true, data: outcome.transaction, state: POINT.SPEND_SUCCESS }
        } catch (err) {
            console.error('Spend point error:', err)
            return { success: false, state: POINT.SERVER_ERROR }
        }
    }

    static async getBalance(userId?: string): Promise<PointResponse<{ balance: number }>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: POINT.UNAUTHORIZED }
        const targetUserId = userId && user.role === 'admin' ? userId : user.id
        const balance = await pointQueries.getBalance(targetUserId)
        return { success: true, data: { balance }, state: POINT.GET_SUCCESS }
    }

    static async getHistory(data: PointHistoryInput): Promise<PaginatedPointResponse<PointTransaction>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: POINT.UNAUTHORIZED }
        const targetUserId = data.userId && user.role === 'admin' ? data.userId : user.id
        const [items, total] = await Promise.all([pointQueries.listByUser(targetUserId, data), pointQueries.countByUser(targetUserId, data)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: POINT.GET_SUCCESS }
    }
}
