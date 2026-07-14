import { z } from 'zod'
import type { Achievement, UserAchievement } from '~/database/schemas'
import { AchievementCode, ACHIEVEMENT_CONDITION_TYPE_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const AchievementIdSchema = z.object({
    achievementId: z.uuid(),
})

export const ListAchievementsSchema = z.object({
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(),
    search: z.string().optional(),
    ...PaginationSchema.shape,
})

export const CreateAchievementSchema = z.object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    description: z.string().min(1),
    iconUrl: z.string().url().optional(),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY),
    conditionValue: z.number().int().min(1),
})

export const UpdateAchievementSchema = z.object({
    achievementId: z.uuid(),
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    iconUrl: z.string().url().optional(),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(),
    conditionValue: z.number().int().min(1).optional(),
})

export type AchievementIdInput = z.infer<typeof AchievementIdSchema>
export type ListAchievementsInput = z.infer<typeof ListAchievementsSchema>
export type CreateAchievementInput = z.infer<typeof CreateAchievementSchema>
export type UpdateAchievementInput = z.infer<typeof UpdateAchievementSchema>

export type UserAchievementWithAchievement = UserAchievement & {
    achievement: Achievement
}

export type AchievementProgress = {
    current: number
    target: number
    percentage: number
}

export type AchievementResponse<T> = ActionResponse<T, AchievementCode>
export type PaginatedAchievementResponse<T> = PaginatedActionResponse<T, AchievementCode>
