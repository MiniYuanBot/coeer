import { achievementQueries } from '../database/queries'
import { ACHIEVEMENT } from '@shared/constants'
import { AuthService } from './AuthService'
import type {
    AchievementResponse,
    AchievementIdInput,
    CreateAchievementInput,
    ListAchievementsInput,
    PaginatedAchievementResponse,
    UpdateAchievementInput,
    UserAchievementWithAchievement,
} from '@shared/contracts'
import type { Achievement } from '../database/schemas'

export class AchievementService {
    static async list(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<Achievement>> {
        const items = await achievementQueries.list(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
    }

    static async listMine(data: ListAchievementsInput): Promise<PaginatedAchievementResponse<UserAchievementWithAchievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        const items = await achievementQueries.listByUser(user.id, data.limit, data.offset)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: ACHIEVEMENT.GET_SUCCESS }
    }

    static async adminCreate(data: CreateAchievementInput): Promise<AchievementResponse<Achievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const achievement = await achievementQueries.create(data)
        return { success: true, data: achievement, state: ACHIEVEMENT.CREATE_SUCCESS }
    }

    static async adminUpdate(data: UpdateAchievementInput): Promise<AchievementResponse<Achievement>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        const achievement = await achievementQueries.update(data)
        return { success: true, data: achievement, state: ACHIEVEMENT.UPDATE_SUCCESS }
    }

    static async adminDelete(data: AchievementIdInput): Promise<AchievementResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACHIEVEMENT.UNAUTHORIZED }
        if (user.role !== 'admin') return { success: false, state: ACHIEVEMENT.FORBIDDEN }
        await achievementQueries.delete(data)
        return { success: true, state: ACHIEVEMENT.DELETE_SUCCESS }
    }
}
