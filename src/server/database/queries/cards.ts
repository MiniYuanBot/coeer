import { and, asc, count, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { cards, NewCard, type Card, userCards } from '../schemas'
import type { ListCardsInput, UpdateCardInput } from '@shared/contracts'

function cardFilter(data: ListCardsInput, viewer?: { id?: string }) {
    return and(data.isHidden !== undefined ? eq(cards.isHidden, data.isHidden) : undefined,
        viewer ? or(eq(cards.isHidden, false), viewer.id ? inArray(cards.id,
            db.select({ id: userCards.cardId }).from(userCards).where(and(eq(userCards.userId, viewer.id), gt(userCards.count, 0)))) : undefined) : undefined,
        data.rarity ? eq(cards.rarity, data.rarity) : undefined,
        data.series ? eq(cards.series, data.series) : undefined,
        data.search ? or(ilike(cards.name, `%${data.search}%`), ilike(cards.description, `%${data.search}%`), ilike(cards.series, `%${data.search}%`)) : undefined)
}

export const cardQueries = {
    async ownershipCounts(ids: string[], userId?: string) {
        if (!userId || !ids.length) return new Map<string, number>()
        const rows = await db.select({ cardId: userCards.cardId, count: userCards.count }).from(userCards)
            .where(and(eq(userCards.userId, userId), inArray(userCards.cardId, ids), gt(userCards.count, 0)))
        return new Map(rows.map(row => [row.cardId, row.count]))
    },
    async deleteUnowned(cardId: string): Promise<'deleted' | 'owned' | 'missing'> {
        return db.transaction(async tx => {
            // Serialize with draws and foreign-key inserts before checking ownership.
            const [card] = await tx.select({ id: cards.id }).from(cards).where(eq(cards.id, cardId)).for('update')
            if (!card) return 'missing'
            const [owner] = await tx.select({ id: userCards.id }).from(userCards).where(eq(userCards.cardId, cardId)).limit(1)
            if (owner) return 'owned'
            await tx.delete(cards).where(eq(cards.id, cardId))
            return 'deleted'
        })
    },
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

    async list(data: ListCardsInput, viewer?: { id?: string }) {
        return db.query.cards.findMany({
            where: cardFilter(data, viewer),
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

    async count(data: ListCardsInput, userId?: string, viewer?: { id?: string }) {
        const [result] = userId
            ? await db.select({ value: count() }).from(userCards).innerJoin(cards, eq(cards.id, userCards.cardId))
                .where(and(eq(userCards.userId, userId), gt(userCards.count, 0), cardFilter(data)))
            : await db.select({ value: count() }).from(cards).where(cardFilter(data, viewer))
        return result.value
    },
}
