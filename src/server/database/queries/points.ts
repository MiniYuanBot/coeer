import { and, desc, eq, sum } from 'drizzle-orm'
import { db } from '../client'
import { NewPointTransaction, pointTransactions } from '../schemas'
import type { PointHistoryInput } from '@shared/contracts'

export const pointQueries = {
    async create(data: NewPointTransaction) {
        const [transaction] = await db.insert(pointTransactions).values(data).returning()
        if (!transaction) throw new Error('Create point transaction failed')
        return transaction
    },

    async listByUser(userId: string, data: PointHistoryInput) {
        const conditions = [eq(pointTransactions.userId, userId)]
        if (data.type) conditions.push(eq(pointTransactions.type, data.type))
        if (data.source) conditions.push(eq(pointTransactions.source, data.source))
        return db.query.pointTransactions.findMany({
            where: and(...conditions),
            orderBy: [desc(pointTransactions.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async getBalance(userId: string): Promise<number> {
        const [result] = await db
            .select({ value: sum(pointTransactions.amount) })
            .from(pointTransactions)
            .where(eq(pointTransactions.userId, userId))
        return Number(result?.value ?? 0)
    },
}

