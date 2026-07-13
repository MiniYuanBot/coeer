import { createServerFn } from '@tanstack/react-start'
import { ListMyReactionsSchema, ListReactionsSchema, ToggleReactionSchema } from '@shared/contracts'
import { ReactionService } from '../services'

export const toggleReactionFn = createServerFn({ method: 'POST' })
    .inputValidator(ToggleReactionSchema)
    .handler(async ({ data }) => ReactionService.toggle(data))

export const getReactionsByTargetFn = createServerFn({ method: 'GET' })
    .inputValidator(ListReactionsSchema)
    .handler(async ({ data }) => ReactionService.listByTarget(data))

export const getMyReactionsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListMyReactionsSchema)
    .handler(async ({ data }) => ReactionService.listMine(data))

