import { pointQueries } from '../database/queries'
import { POINT, type PointSource } from '@shared/constants'
import { AuthService } from './AuthService'
import { db, type DbExecutor } from '../database/client'
import type { PaginatedPointResponse, PointChangeInput, PointHistoryInput, PointResponse } from '@shared/contracts'
import type { PointTransaction } from '../database/schemas'

export type SpendOutcome =
    | { ok: true; transaction: PointTransaction }
    | { ok: false; code: 'INSUFFICIENT_POINTS' | 'SERVER_ERROR' }

type PointChangeInternal = Omit<PointChangeInput, 'userId'> & { userId: string; source: PointSource }

export class PointService {
    /**
     * Authorized balance change for an explicit target user.
     * Only used by internal business services (redeem, draw) inside a
     * transaction — never exposed directly as a server function.
     *
     * Serialization: the user row is locked (SELECT … FOR UPDATE) so two
     * concurrent spends/draws can not double-spend, and the balance is
     * re-read after the lock.
     */
    static async spendInTx(data: PointChangeInternal, executor: DbExecutor): Promise<SpendOutcome> {
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

            const transaction = await pointQueries.create({ ...data, amount: data.amount, type: 'earn' })
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

            // Best-effort non-transactional path (the redeem/draw services
            // always use `spendInTx` inside a real transaction).
            const outcome = await PointService.spendInTx(
                { ...data, source: data.source ?? 'adjustment' },
                db,
            )
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
        const items = await pointQueries.listByUser(targetUserId, data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: POINT.GET_SUCCESS }
    }
}
