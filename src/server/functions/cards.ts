import { createServerFn } from '@tanstack/react-start'
import { CreateCardSchema, DrawCardsSchema, ListCardsSchema } from '@shared/contracts'
import { CardService } from '../services'

export const drawCardsFn = createServerFn({ method: 'POST' })
    .inputValidator(DrawCardsSchema)
    .handler(async ({ data }) => CardService.draw(data))

export const getCardPoolFn = createServerFn({ method: 'GET' })
    .inputValidator(ListCardsSchema)
    .handler(async ({ data }) => CardService.listCards(data))

export const getMyCardsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListCardsSchema)
    .handler(async ({ data }) => CardService.listMine(data))

export const adminCreateCardFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateCardSchema)
    .handler(async ({ data }) => CardService.adminCreate(data))

