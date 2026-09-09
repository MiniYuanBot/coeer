import { cardQueries } from '../database/queries/cards'
import { db } from '../database/client'
import { CARD } from '@shared/constants'
import { AuthService } from './AuthService'
import { PointService } from './PointService'
import type {
    CardResponse,
    CreateCardInput,
    DrawCardsInput,
    DrawResult,
    ListCardsInput,
    PaginatedCardResponse,
    UserCardWithCard,
} from '@shared/contracts'
import type { Card } from '../database/schemas'

const DRAW_COST = 50

/**
 * Weighted random pick over the card pool by `dropRate`.
 * Falls back to a uniform pick when all weights are zero/invalid.
 */
function pickFromPool(pool: Card[]): Card | null {
    if (pool.length === 0) return null

    const weights = pool.map((card) => Math.max(0, Number.parseFloat(String(card.dropRate)) || 0))
    const total = weights.reduce((acc, w) => acc + w, 0)

    if (total <= 0) {
        return pool[Math.floor(Math.random() * pool.length)] ?? null
    }

    let cursor = Math.random() * total
    for (let i = 0; i < pool.length; i += 1) {
        cursor -= weights[i]
        if (cursor <= 0) return pool[i] ?? null
    }
    return pool[pool.length - 1] ?? null
}

export class CardService {
    static async draw(data: DrawCardsInput): Promise<CardResponse<DrawResult>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }

        const count = data.count ?? 1

        // Fail before charging when the pool is empty.
        const prePool = await cardQueries.listPool()
        if (prePool.length === 0) return { success: false, state: CARD.EMPTY_POOL }

        let result: CardResponse<DrawResult>
        try {
            await db.transaction(async (tx) => {
                const spent = await PointService.spendInTx(
                    { userId: user.id, amount: DRAW_COST * count, source: 'draw' },
                    tx,
                )
                if (!spent.ok) {
                    result = {
                        success: false,
                        state: spent.code === 'INSUFFICIENT_POINTS' ? CARD.INSUFFICIENT_POINTS : CARD.SERVER_ERROR,
                    }
                    return
                }

                // Re-read the pool inside the transaction and draw weighted by dropRate.
                const pool = await cardQueries.listPool(tx)
                const results: UserCardWithCard[] = []
                for (let i = 0; i < count; i += 1) {
                    const card = pickFromPool(pool)
                    if (!card) break
                    const userCard = await cardQueries.upsertUserCard(user.id, card.id, tx)
                    if (userCard) results.push({ ...userCard, card })
                }

                result = {
                    success: true,
                    data: { cards: results, pointsSpent: DRAW_COST * count },
                    state: CARD.DRAW_SUCCESS,
                }
            })
            return result!
        } catch (err) {
            console.error('Draw card error:', err)
            return { success: false, state: CARD.SERVER_ERROR }
        }
    }

    static async listCards(data: ListCardsInput): Promise<PaginatedCardResponse<Card>> {
        const items = await cardQueries.list(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: CARD.GET_SUCCESS }
    }

    static async listMine(data: ListCardsInput): Promise<PaginatedCardResponse<UserCardWithCard>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }
        const items = await cardQueries.listUserCards(user.id, data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: CARD.GET_SUCCESS }
    }

    static async adminCreate(data: CreateCardInput): Promise<CardResponse<Card>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: CARD.FORBIDDEN }
        const card = await cardQueries.create({ ...data, dropRate: String(data.dropRate) })
        return { success: true, data: card, state: CARD.CREATE_SUCCESS }
    }
}
