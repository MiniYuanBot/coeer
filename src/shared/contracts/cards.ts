import { z } from 'zod'
import type { Card, UserCard } from '~/database/schemas'
import { CardCode, CARD_RARITY_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const CardIdSchema = z.object({
    cardId: z.uuid(),
})

export const DrawCardsSchema = z.object({
    count: z.number().int().min(1).max(10).optional().default(1),
})

export const ListCardsSchema = z.object({
    rarity: z.enum(CARD_RARITY_ARRAY).optional(),
    series: z.string().optional(),
    ...PaginationSchema.shape,
})

export const CreateCardSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    imageUrl: z.string().url(),
    rarity: z.enum(CARD_RARITY_ARRAY),
    series: z.string().max(100).optional(),
    dropRate: z.number().min(0).max(1),
})

export type CardIdInput = z.infer<typeof CardIdSchema>
export type DrawCardsInput = z.infer<typeof DrawCardsSchema>
export type ListCardsInput = z.infer<typeof ListCardsSchema>
export type CreateCardInput = z.infer<typeof CreateCardSchema>

export type UserCardWithCard = UserCard & {
    card: Card
}

export type DrawResult = {
    cards: UserCardWithCard[]
    pointsSpent: number
}

export type CardResponse<T> = ActionResponse<T, CardCode>
export type PaginatedCardResponse<T> = PaginatedActionResponse<T, CardCode>

