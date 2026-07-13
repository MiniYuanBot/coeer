import { createServerFn } from '@tanstack/react-start'
import {
    CreateReplySchema,
    ListChildRepliesSchema,
    ListRepliesByAuthorSchema,
    ListRepliesByTargetSchema,
    ReplyIdSchema,
    UpdateReplySchema,
} from '@shared/contracts'
import { ReplyService } from '../services'

export const createReplyFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateReplySchema)
    .handler(async ({ data }) => ReplyService.create(data))

export const getReplyByIdFn = createServerFn({ method: 'GET' })
    .inputValidator(ReplyIdSchema)
    .handler(async ({ data }) => ReplyService.getById(data))

export const listRepliesByTargetFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRepliesByTargetSchema)
    .handler(async ({ data }) => ReplyService.listByTarget(data))

export const listChildRepliesFn = createServerFn({ method: 'GET' })
    .inputValidator(ListChildRepliesSchema)
    .handler(async ({ data }) => ReplyService.listChildren(data))

export const listRepliesByAuthorFn = createServerFn({ method: 'GET' })
    .inputValidator(ListRepliesByAuthorSchema)
    .handler(async ({ data }) => ReplyService.listByAuthor(data))

export const updateReplyFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateReplySchema)
    .handler(async ({ data }) => ReplyService.update(data))

export const deleteReplyFn = createServerFn({ method: 'POST' })
    .inputValidator(ReplyIdSchema)
    .handler(async ({ data }) => ReplyService.delete(data))

