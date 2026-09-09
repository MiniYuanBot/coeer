import { db } from '../database/client'
import { redeemQueries } from '../database/queries'
import { REDEEM } from '@shared/constants'
import { AuthService } from './AuthService'
import { PointService } from './PointService'
import type {
    CreateRedeemItemInput,
    ListRedeemItemsInput,
    ListRedeemOrdersInput,
    PaginatedRedeemResponse,
    ProcessRedeemOrderInput,
    RedeemItemInput,
    RedeemItemIdInput,
    RedeemOrderIdInput,
    RedeemOrderWithDetails,
    RedeemOrderWithItem,
    RedeemResponse,
    UpdateRedeemItemInput,
} from '@shared/contracts'
import type { RedeemItem, RedeemOrder } from '../database/schemas'

export class RedeemService {
    static async listItems(data: ListRedeemItemsInput): Promise<PaginatedRedeemResponse<RedeemItem>> {
        const items = await redeemQueries.listAvailable(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REDEEM.GET_SUCCESS }
    }

    /**
     * Redeem an item. Points deduction, stock decrement and order creation run
     * in a single DB transaction with the user row locked, so concurrent
     * redemptions can neither oversell nor double-spend.
     */
    static async redeem(data: RedeemItemInput): Promise<RedeemResponse<RedeemOrder>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }

        const quantity = data.quantity ?? 1

        let result: RedeemResponse<RedeemOrder>
        try {
            await db.transaction(async (tx) => {
                // Fresh read inside the transaction (no cross-request race).
                const item = await redeemQueries.findItemById(data.itemId, tx)
                if (!item || item.status !== 'active') {
                    result = { success: false, state: REDEEM.ITEM_NOT_FOUND }
                    return
                }
                if (item.stock !== -1 && item.stock < quantity) {
                    result = { success: false, state: REDEEM.OUT_OF_STOCK }
                    return
                }

                const spent = await PointService.spendInTx(
                    { userId: user.id, amount: item.pointsCost * quantity, source: 'redeem' },
                    tx,
                )
                if (!spent.ok) {
                    result = {
                        success: false,
                        state: spent.code === 'INSUFFICIENT_POINTS' ? REDEEM.INSUFFICIENT_POINTS : REDEEM.SERVER_ERROR,
                    }
                    return
                }

                // Unlimited items (`stock = -1`) are never decremented.
                if (item.stock !== -1) {
                    const updated = await redeemQueries.decrementStock(item.id, quantity, tx)
                    if (!updated) {
                        result = { success: false, state: REDEEM.OUT_OF_STOCK }
                        return
                    }
                }

                const order = await redeemQueries.createOrder(
                    { userId: user.id, itemId: item.id, quantity, status: 'pending' },
                    tx,
                )
                result = { success: true, data: order, state: REDEEM.ORDER_SUCCESS }
            })
            return result!
        } catch (err) {
            console.error('Redeem error:', err)
            return { success: false, state: REDEEM.SERVER_ERROR }
        }
    }

    static async listMyOrders(data: ListRedeemOrdersInput): Promise<PaginatedRedeemResponse<RedeemOrderWithItem>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        const items = await redeemQueries.listOrdersByUser(user.id, data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REDEEM.GET_SUCCESS }
    }

    static async adminListOrders(data: ListRedeemOrdersInput): Promise<PaginatedRedeemResponse<RedeemOrderWithDetails>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        const items = await redeemQueries.listOrders(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REDEEM.GET_SUCCESS }
    }

    /**
     * Order details (incl. the redeem code for virtual goods) are only
     * readable by the owner or a platform admin — previously any caller
     * could fetch any order by id.
     */
    static async getOrder(data: RedeemOrderIdInput): Promise<RedeemResponse<RedeemOrderWithDetails>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }

        const order = await redeemQueries.findOrderById(data.orderId)
        if (!order) return { success: false, state: REDEEM.ORDER_NOT_FOUND }
        if (order.userId !== user.id && user.role !== 'admin') {
            return { success: false, state: REDEEM.ORDER_NOT_FOUND }
        }
        return { success: true, data: order, state: REDEEM.GET_SUCCESS }
    }

    static async adminCreateItem(data: CreateRedeemItemInput): Promise<RedeemResponse<RedeemItem>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        const item = await redeemQueries.createItem({ ...data, status: 'active' })
        return { success: true, data: item, state: REDEEM.CREATE_SUCCESS }
    }

    static async adminUpdateItem(data: UpdateRedeemItemInput): Promise<RedeemResponse<RedeemItem>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        const item = await redeemQueries.updateItem(data)
        return { success: true, data: item, state: REDEEM.UPDATE_SUCCESS }
    }

    static async adminDeleteItem(data: RedeemItemIdInput): Promise<RedeemResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        await redeemQueries.deleteItem(data.itemId)
        return { success: true, state: REDEEM.DELETE_SUCCESS }
    }

    static async adminProcessOrder(data: ProcessRedeemOrderInput): Promise<RedeemResponse<RedeemOrder>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        const order = await redeemQueries.updateOrder(data)
        return { success: true, data: order, state: REDEEM.UPDATE_SUCCESS }
    }
}
