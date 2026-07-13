import { and, eq, sql, SQL } from 'drizzle-orm'
import { db } from '../client'
import { cards, NewCard, userCards } from '../schemas'
import type { CreateCardInput, ListCardsInput } from '@shared/contracts'

function buildCardWhere(data: ListCardsInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.rarity) conditions.push(eq(cards.rarity, data.rarity))
    if (data.series) conditions.push(eq(cards.series, data.series))
    return conditions.length ? and(...conditions) : undefined
}

export const cardQueries = {
    async create(data: NewCard) {
        const [card] = await db.insert(cards).values(data).returning()
        if (!card) throw new Error('Create card failed')
        return card
    },

    async list(data: ListCardsInput) {
        return db.query.cards.findMany({
            where: buildCardWhere(data),
            limit: data.limit,
            offset: data.offset,
        })
    },

    async findById(cardId: string) {
        return db.query.cards.findFirst({ where: eq(cards.id, cardId) })
    },

    async randomOne() {
        return db.query.cards.findFirst({ orderBy: sql`random()` })
    },

    async upsertUserCard(userId: string, cardId: string) {
        const existing = await db.query.userCards.findFirst({
            where: and(eq(userCards.userId, userId), eq(userCards.cardId, cardId)),
        })
        if (existing) {
            const [updated] = await db.update(userCards)
                .set({ count: existing.count + 1 })
                .where(eq(userCards.id, existing.id))
                .returning()
            return updated
        }
        const [created] = await db.insert(userCards).values({ userId, cardId }).returning()
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

