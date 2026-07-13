import { pointQueries } from '../database/queries'
import { POINT } from '@shared/constants'
import { AuthService } from './AuthService'
import type { PaginatedPointResponse, PointChangeInput, PointHistoryInput, PointResponse } from '@shared/contracts'
import type { PointTransaction } from '../database/schemas'

export class PointService {
    static async earn(data: PointChangeInput): Promise<PointResponse<PointTransaction>> {
        try {
            const transaction = await pointQueries.create({ ...data, amount: data.amount, type: 'earn' })
            return { success: true, data: transaction, state: POINT.EARN_SUCCESS }
        } catch (err) {
            console.error('Earn point error:', err)
            return { success: false, state: POINT.SERVER_ERROR }
        }
    }

    static async spend(data: PointChangeInput): Promise<PointResponse<PointTransaction>> {
        try {
            const balance = await pointQueries.getBalance(data.userId)
            if (balance < data.amount) return { success: false, state: POINT.INSUFFICIENT }
            const transaction = await pointQueries.create({ ...data, amount: -data.amount, type: 'spend' })
            return { success: true, data: transaction, state: POINT.SPEND_SUCCESS }
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

