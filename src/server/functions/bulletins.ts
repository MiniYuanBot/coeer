import { createServerFn } from '@tanstack/react-start'
import { BulletinIdSchema, CreateBulletinSchema, ListBulletinsSchema, UpdateBulletinSchema } from '@shared/contracts'
import { BulletinService } from '../services'

export const createBulletinFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateBulletinSchema)
    .handler(async ({ data }) => BulletinService.create(data))

export const getBulletinByIdFn = createServerFn({ method: 'GET' })
    .inputValidator(BulletinIdSchema)
    .handler(async ({ data }) => BulletinService.getById(data))

export const getBulletinFeedFn = createServerFn({ method: 'GET' })
    .inputValidator(ListBulletinsSchema)
    .handler(async ({ data }) => BulletinService.list(data))

export const updateBulletinFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateBulletinSchema)
    .handler(async ({ data }) => BulletinService.update(data))

export const deleteBulletinFn = createServerFn({ method: 'POST' })
    .inputValidator(BulletinIdSchema)
    .handler(async ({ data }) => BulletinService.delete(data))

