import { and, eq, gt, or, SQL } from 'drizzle-orm'
import { db } from '../client'
import { NewRedeemItem, NewRedeemOrder, redeemItems, redeemOrders } from '../schemas'
import type { ListRedeemItemsInput, ListRedeemOrdersInput, ProcessRedeemOrderInput } from '@shared/contracts'

function buildItemWhere(data: ListRedeemItemsInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.status) conditions.push(eq(redeemItems.status, data.status))
    if (data.type) conditions.push(eq(redeemItems.type, data.type))
    return conditions.length ? and(...conditions) : undefined
}

export const redeemQueries = {
    async createItem(data: NewRedeemItem) {
        const [item] = await db.insert(redeemItems).values(data).returning()
        if (!item) throw new Error('Create redeem item failed')
        return item
    },

    async listItems(data: ListRedeemItemsInput) {
        return db.query.redeemItems.findMany({
            where: buildItemWhere(data),
            limit: data.limit,
            offset: data.offset,
        })
    },

    async listAvailable(data: ListRedeemItemsInput) {
        const base = buildItemWhere({ ...data, status: 'active' })
        const stockWhere = or(eq(redeemItems.stock, -1), gt(redeemItems.stock, 0))
        return db.query.redeemItems.findMany({
            where: base ? and(base, stockWhere!) : stockWhere,
            limit: data.limit,
            offset: data.offset,
        })
    },

    async findItemById(itemId: string) {
        return db.query.redeemItems.findFirst({ where: eq(redeemItems.id, itemId) })
    },

    async createOrder(data: NewRedeemOrder) {
        const [order] = await db.insert(redeemOrders).values(data).returning()
        if (!order) throw new Error('Create redeem order failed')
        return order
    },

    async decrementStock(itemId: string, quantity: number) {
        const item = await this.findItemById(itemId)
        if (!item || item.stock < 0) return item
        const [updated] = await db.update(redeemItems)
            .set({ stock: item.stock - quantity })
            .where(eq(redeemItems.id, itemId))
            .returning()
        return updated
    },

    async listOrdersByUser(userId: string, data: ListRedeemOrdersInput) {
        const conditions = [eq(redeemOrders.userId, userId)]
        if (data.status) conditions.push(eq(redeemOrders.status, data.status))
        return db.query.redeemOrders.findMany({
            where: and(...conditions),
            with: { item: true },
            limit: data.limit,
            offset: data.offset,
        })
    },

    async findOrderById(orderId: string) {
        return db.query.redeemOrders.findFirst({
            where: eq(redeemOrders.id, orderId),
            with: { item: true, user: { columns: { id: true, name: true } } },
        })
    },

    async updateOrder(data: ProcessRedeemOrderInput) {
        const [order] = await db.update(redeemOrders)
            .set({
                status: data.status,
                redeemCode: data.redeemCode,
                completedAt: data.status === 'completed' ? new Date() : undefined,
            })
            .where(eq(redeemOrders.id, data.orderId))
            .returning()
        if (!order) throw new Error('Redeem order not found')
        return order
    },
}

