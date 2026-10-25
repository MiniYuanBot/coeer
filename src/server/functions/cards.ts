import { createServerFn } from '@tanstack/react-start'
import { CardIdSchema, CreateCardSchema, DrawCardsSchema, ListCardsSchema, UpdateCardSchema } from '@shared/contracts'
import { CardService } from '../services'

export const drawCardsFn = createServerFn({ method: 'POST' })
    .inputValidator(DrawCardsSchema)
    .handler(async ({ data }) => {
        const result = await CardService.draw(data)
        if (!result.success || !result.data) {
            throw new Error(result.state.message || '抽卡失败')
        }
        return result.data
    })

export const getCardPoolFn = createServerFn({ method: 'GET' })
    .inputValidator(ListCardsSchema)
    .handler(async ({ data }) => CardService.listCards(data))

export const adminListCardsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListCardsSchema)
    .handler(async ({ data }) => CardService.adminList(data))

export const adminGetCardFn = createServerFn({ method: 'GET' })
    .inputValidator(CardIdSchema)
    .handler(async ({ data }) => CardService.adminGet(data))

export const getMyCardsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListCardsSchema)
    .handler(async ({ data }) => CardService.listMine(data))

export const adminCreateCardFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateCardSchema)
    .handler(async ({ data }) => CardService.adminCreate(data))

export const adminUpdateCardFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateCardSchema)
    .handler(async ({ data }) => CardService.adminUpdate(data))

export const adminDeleteCardFn = createServerFn({ method: 'POST' })
    .inputValidator(CardIdSchema)
    .handler(async ({ data }) => CardService.adminDelete(data))

