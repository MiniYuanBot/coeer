import { and, asc, count, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { cards, NewCard, type Card, userCards } from '../schemas'
import type { ListCardsInput, UpdateCardInput } from '@shared/contracts'

function cardFilter(data: ListCardsInput) {
    return and(data.rarity ? eq(cards.rarity, data.rarity) : undefined,
        data.series ? eq(cards.series, data.series) : undefined,
        data.search ? or(ilike(cards.name, `%${data.search}%`), ilike(cards.description, `%${data.search}%`), ilike(cards.series, `%${data.search}%`)) : undefined)
}

export const cardQueries = {
    async create(data: NewCard) {
        const [card] = await db.insert(cards).values(data).returning()
        if (!card) throw new Error('Create card failed')
        return card
    },

    async update(data: Omit<UpdateCardInput, 'dropRate'> & { dropRate?: string }) {
        const { cardId, ...values } = data
        const [card] = await db.update(cards).set(values).where(eq(cards.id, cardId)).returning()
        return card
    },

    async list(data: ListCardsInput) {
        return db.query.cards.findMany({
            where: cardFilter(data),
            orderBy: [asc(cards.name), asc(cards.id)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async findById(cardId: string) {
        return db.query.cards.findFirst({ where: eq(cards.id, cardId) })
    },

    /** All drawable cards (the pool is small — weighted draw happens in JS). */
    async listPool(executor: DbExecutor = db): Promise<Card[]> {
        return executor.select().from(cards).where(gt(cards.dropRate, '0')).orderBy(asc(cards.id)).for('share')
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
            where: and(eq(userCards.userId, userId), gt(userCards.count, 0), inArray(userCards.cardId, db.select({ id: cards.id }).from(cards).where(cardFilter(data)))),
            with: { card: true },
            orderBy: [asc(userCards.cardId)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async count(data: ListCardsInput, userId?: string) {
        const [result] = userId
            ? await db.select({ value: count() }).from(userCards).innerJoin(cards, eq(cards.id, userCards.cardId))
                .where(and(eq(userCards.userId, userId), gt(userCards.count, 0), cardFilter(data)))
            : await db.select({ value: count() }).from(cards).where(cardFilter(data))
        return result.value
    },
}
