import { cardQueries } from '../database/queries/cards'
import { db } from '../database/client'
import { CARD, CARD_DRAW_COST } from '@shared/constants'
import { CardIdSchema, CreateCardSchema } from '@shared/contracts/cards'
import { AuthService } from './AuthService'
import { PointService } from './PointService'
import { AchievementService } from './AchievementService'
import type {
    CardResponse,
    CardIdInput,
    CreateCardInput,
    DrawCardsInput,
    DrawResult,
    ListCardsInput,
    PaginatedCardResponse,
    UserCardWithCard,
    UpdateCardInput,
} from '@shared/contracts'
import type { Card } from '../database/schemas'

/**
 * Weighted random pick over the card pool by `dropRate`.
 */
function pickFromPool(pool: Card[]): Card | null {
    if (pool.length === 0) return null

    const weights = pool.map((card) => Math.max(0, Number.parseFloat(String(card.dropRate)) || 0))
    const total = weights.reduce((acc, w) => acc + w, 0)

    if (total <= 0) return null

    let cursor = Math.random() * total
    for (let i = 0; i < pool.length; i += 1) {
        if (weights[i] > 0 && cursor < weights[i]) return pool[i] ?? null
        cursor -= weights[i]
    }
    return pool[pool.length - 1] ?? null
}

export class CardService {
    static async adminDelete(data: CardIdInput): Promise<CardResponse<null>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: CARD.UNAUTHORIZED }
        if (current.data.role !== 'admin') return { success: false, state: CARD.FORBIDDEN }
        const parsed = CardIdSchema.safeParse(data)
        if (!parsed.success) return { success: false, state: CARD.INVALID_INPUT }
        try {
            const result = await cardQueries.deleteUnowned(parsed.data.cardId)
            if (result === 'missing') return { success: false, state: CARD.NOT_FOUND }
            if (result === 'owned') return { success: false, state: CARD.IN_USE }
            return { success: true, data: null, state: CARD.DELETE_SUCCESS }
        } catch (error) {
            console.error('Delete card error:', error)
            return { success: false, state: CARD.SERVER_ERROR }
        }
    }

    static async draw(data: DrawCardsInput): Promise<CardResponse<DrawResult>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }

        const count = data.count ?? 1

        let result: CardResponse<DrawResult>
        try {
            await db.transaction(async (tx) => {
                // Lock eligible definitions so an edit cannot empty the charged draw's pool.
                const pool = await cardQueries.listPool(tx)
                if (!pool.length) {
                    result = { success: false, state: CARD.EMPTY_POOL }
                    return
                }
                const spent = await PointService.spendInTx(
                    { userId: user.id, amount: CARD_DRAW_COST * count, source: 'draw' },
                    tx,
                )
                if (!spent.ok) {
                    result = {
                        success: false,
                        state: spent.code === 'INSUFFICIENT_POINTS' ? CARD.INSUFFICIENT_POINTS : CARD.SERVER_ERROR,
                    }
                    return
                }

                const results: UserCardWithCard[] = []
                for (let i = 0; i < count; i += 1) {
                    const card = pickFromPool(pool)
                    if (!card) throw new Error('Drawable card pool is empty')
                    const userCard = await cardQueries.upsertUserCard(user.id, card.id, tx)
                    if (!userCard) throw new Error('Failed to persist drawn card')
                    results.push({ ...userCard, card })
                }

                await AchievementService.syncForUser(user.id, tx)
                result = {
                    success: true,
                    data: { cards: results, pointsSpent: CARD_DRAW_COST * count },
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
        const [items, total] = await Promise.all([cardQueries.list(data), cardQueries.count(data)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: CARD.GET_SUCCESS }
    }

    static async listMine(data: ListCardsInput): Promise<PaginatedCardResponse<UserCardWithCard>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }
        const [items, total] = await Promise.all([cardQueries.listUserCards(user.id, data), cardQueries.count(data, user.id)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: CARD.GET_SUCCESS }
    }

    static async adminCreate(data: CreateCardInput): Promise<CardResponse<Card>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: CARD.FORBIDDEN }
        const parsed = CreateCardSchema.safeParse(data)
        if (!parsed.success) return { success: false, state: CARD.INVALID_INPUT }
        const card = await cardQueries.create({ ...parsed.data, dropRate: String(parsed.data.dropRate) })
        return { success: true, data: card, state: CARD.CREATE_SUCCESS }
    }

    static async adminUpdate(data: UpdateCardInput): Promise<CardResponse<Card>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: CARD.UNAUTHORIZED }
        if (current.data.role !== 'admin') return { success: false, state: CARD.FORBIDDEN }
        const existing = await cardQueries.findById(data.cardId)
        if (!existing) return { success: false, state: CARD.NOT_FOUND }
        const parsed = CreateCardSchema.safeParse({ ...existing, description: existing.description ?? '', series: existing.series ?? '', dropRate: Number(existing.dropRate), ...data })
        if (!parsed.success) return { success: false, state: CARD.INVALID_INPUT }
        const card = await cardQueries.update({ cardId: data.cardId, ...parsed.data, dropRate: String(parsed.data.dropRate) })
        if (!card) return { success: false, state: CARD.NOT_FOUND }
        return { success: true, data: card, state: CARD.UPDATE_SUCCESS }
    }
}
