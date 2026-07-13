import { cardQueries } from '../database/queries'
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

export class CardService {
    static async draw(data: DrawCardsInput): Promise<CardResponse<DrawResult>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: CARD.UNAUTHORIZED }

        const count = data.count ?? 1
        const spent = await PointService.spend({ userId: user.id, amount: DRAW_COST * count, source: 'draw' })
        if (!spent.success) return { success: false, state: CARD.SERVER_ERROR }

        const results: UserCardWithCard[] = []
        for (let i = 0; i < count; i += 1) {
            const card = await cardQueries.randomOne()
            if (!card) break
            const userCard = await cardQueries.upsertUserCard(user.id, card.id)
            if (userCard) results.push({ ...userCard, card })
        }

        return { success: true, data: { cards: results, pointsSpent: DRAW_COST * count }, state: CARD.DRAW_SUCCESS }
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

