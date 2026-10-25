import { z } from 'zod'
import type { Achievement, UserAchievement } from '~/database/schemas'
import { AchievementCode, ACHIEVEMENT_CONDITION_TYPE_ARRAY, resolveAchievementCondition } from '../constants'
import { ImageUrlSchema } from '../images'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'

export const AchievementIdSchema = z.object({
    achievementId: z.uuid(),
})

export const ListAchievementsSchema = z.object({
    isHidden: z.boolean().optional(),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(),
    search: z.string().optional(),
    ...PaginationSchema.shape,
})

export const CreateAchievementSchema = z.object({
    isHidden: z.boolean().optional(),
    code: z.string().trim().min(1).max(50),
    name: z.string().trim().min(1).max(100),
    description: z.string().min(1),
    iconUrl: ImageUrlSchema.nullable().optional(),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY),
    conditionValue: z.number().int().min(1).max(2147483647),
}).refine((data) => {
    const condition = resolveAchievementCondition(data.conditionType, data.code)
    return condition !== undefined && (condition !== 'registration' || data.conditionValue === 1)
}, { message: '请选择有效的解锁条件；注册即得的条件数值必须为 1', path: ['conditionType'] })

export const UpdateAchievementSchema = z.object({
    isHidden: z.boolean().optional(),
    achievementId: z.uuid(),
    code: z.string().min(1).max(50).optional(),
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(1).optional(),
    iconUrl: ImageUrlSchema.nullable().optional(),
    conditionType: z.enum(ACHIEVEMENT_CONDITION_TYPE_ARRAY).optional(),
    conditionValue: z.number().int().min(1).max(2147483647).optional(),
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

export type AchievementWithProgress = Achievement & { unlocked: boolean; progress?: AchievementProgress }

export type AchievementResponse<T> = ActionResponse<T, AchievementCode>
export type PaginatedAchievementResponse<T> = PaginatedActionResponse<T, AchievementCode>
