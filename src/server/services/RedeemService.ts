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
    RedeemOrderIdInput,
    RedeemOrderWithDetails,
    RedeemOrderWithItem,
    RedeemResponse,
} from '@shared/contracts'
import type { RedeemItem, RedeemOrder } from '../database/schemas'

export class RedeemService {
    static async listItems(data: ListRedeemItemsInput): Promise<PaginatedRedeemResponse<RedeemItem>> {
        const items = await redeemQueries.listAvailable(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REDEEM.GET_SUCCESS }
    }

    static async redeem(data: RedeemItemInput): Promise<RedeemResponse<RedeemOrder>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        const item = await redeemQueries.findItemById(data.itemId)
        if (!item || item.status !== 'active') return { success: false, state: REDEEM.ITEM_NOT_FOUND }
        const quantity = data.quantity ?? 1
        if (item.stock !== -1 && item.stock < quantity) return { success: false, state: REDEEM.OUT_OF_STOCK }
        const spent = await PointService.spend({ userId: user.id, amount: item.pointsCost * quantity, source: 'redeem' })
        if (!spent.success) return { success: false, state: REDEEM.INSUFFICIENT_POINTS }
        await redeemQueries.decrementStock(item.id, quantity)
        const order = await redeemQueries.createOrder({ userId: user.id, itemId: item.id, status: 'pending' })
        return { success: true, data: order, state: REDEEM.ORDER_SUCCESS }
    }

    static async listMyOrders(data: ListRedeemOrdersInput): Promise<PaginatedRedeemResponse<RedeemOrderWithItem>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        const items = await redeemQueries.listOrdersByUser(user.id, data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: REDEEM.GET_SUCCESS }
    }

    static async getOrder(data: RedeemOrderIdInput): Promise<RedeemResponse<RedeemOrderWithDetails>> {
        const order = await redeemQueries.findOrderById(data.orderId)
        if (!order) return { success: false, state: REDEEM.ORDER_NOT_FOUND }
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

    static async adminProcessOrder(data: ProcessRedeemOrderInput): Promise<RedeemResponse<RedeemOrder>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: REDEEM.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: REDEEM.FORBIDDEN }
        const order = await redeemQueries.updateOrder(data)
        return { success: true, data: order, state: REDEEM.UPDATE_SUCCESS }
    }
}

