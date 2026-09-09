import { and, eq, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { cards, NewCard, type Card, userCards } from '../schemas'
import type { CreateCardInput, ListCardsInput } from '@shared/contracts'

export const cardQueries = {
    async create(data: NewCard) {
        const [card] = await db.insert(cards).values(data).returning()
        if (!card) throw new Error('Create card failed')
        return card
    },

    async list(data: ListCardsInput) {
        const conditions: ReturnType<typeof eq>[] = []
        if (data.rarity) conditions.push(eq(cards.rarity, data.rarity))
        if (data.series) conditions.push(eq(cards.series, data.series))
        return db.query.cards.findMany({
            where: conditions.length ? and(...conditions) : undefined,
            limit: data.limit,
            offset: data.offset,
        })
    },

    async findById(cardId: string) {
        return db.query.cards.findFirst({ where: eq(cards.id, cardId) })
    },

    /** All drawable cards (the pool is small — weighted draw happens in JS). */
    async listPool(executor: DbExecutor = db): Promise<Card[]> {
        return executor.select().from(cards)
    },

    async upsertUserCard(userId: string, cardId: string, executor: DbExecutor = db) {
        const existing = await executor.query.userCards.findFirst({
            where: and(eq(userCards.userId, userId), eq(userCards.cardId, cardId)),
        })
        if (existing) {
            const [updated] = await executor
                .update(userCards)
                .set({ count: sql`${userCards.count} + 1` })
                .where(eq(userCards.id, existing.id))
                .returning()
            return updated
        }
        const [created] = await executor.insert(userCards).values({ userId, cardId }).returning()
        return created
    },

    async listUserCards(userId: string, data: ListCardsInput) {
        return db.query.userCards.findMany({
            where: eq(userCards.userId, userId),
            with: { card: true },
            limit: data.limit,
            offset: data.offset,
        })
    },
}
