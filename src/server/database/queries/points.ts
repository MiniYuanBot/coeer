import { and, desc, eq, sum } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { NewPointTransaction, pointTransactions, users } from '../schemas'
import type { PointHistoryInput } from '@shared/contracts'

export const pointQueries = {
    async create(data: NewPointTransaction, executor: DbExecutor = db) {
        const [transaction] = await executor.insert(pointTransactions).values(data).returning()
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

    /**
     * Balance for a user. When called inside a transaction the caller is
     * responsible for locking the user row (`lockUser`) so concurrent
     * spenders serialize.
     */
    async getBalance(userId: string, executor: DbExecutor = db): Promise<number> {
        const [result] = await executor
            .select({ value: sum(pointTransactions.amount) })
            .from(pointTransactions)
            .where(eq(pointTransactions.userId, userId))
        return Number(result?.value ?? 0)
    },

    /** Lock the user row for the duration of a transaction (SELECT … FOR UPDATE). */
    async lockUser(userId: string, executor: DbExecutor): Promise<void> {
        await executor
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, userId))
            .for('update')
    },
}


