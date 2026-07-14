import { createServerFn } from '@tanstack/react-start'
import { AchievementIdSchema, CreateAchievementSchema, ListAchievementsSchema, UpdateAchievementSchema } from '@shared/contracts'
import { AchievementService } from '../services'

export const getAllAchievementsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListAchievementsSchema)
    .handler(async ({ data }) => AchievementService.list(data))

export const getMyAchievementsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListAchievementsSchema)
    .handler(async ({ data }) => AchievementService.listMine(data))

export const adminCreateAchievementFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateAchievementSchema)
    .handler(async ({ data }) => AchievementService.adminCreate(data))

export const adminUpdateAchievementFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateAchievementSchema)
    .handler(async ({ data }) => AchievementService.adminUpdate(data))

export const adminDeleteAchievementFn = createServerFn({ method: 'POST' })
    .inputValidator(AchievementIdSchema)
    .handler(async ({ data }) => AchievementService.adminDelete(data))
