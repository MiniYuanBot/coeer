import { activityQueries } from '../database/queries'
import { ACTIVITY } from '@shared/constants'
import { AuthService } from './AuthService'
import type {
    ActivityIdInput,
    ActivityParticipantIdInput,
    ActivityParticipantWithUser,
    ActivityResponse,
    ActivityWithOrganizer,
    CreateActivityInput,
    ListActivitiesInput,
    ListActivityParticipantsInput,
    PaginatedActivityResponse,
    RegisterActivityInput,
    UpdateActivityInput,
} from '@shared/contracts'

export class ActivityService {
    static async create(data: CreateActivityInput): Promise<ActivityResponse<ActivityWithOrganizer>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }

        const activity = await activityQueries.create({
            ...data,
            organizerType: data.organizerType ?? 'user',
            organizerId: data.organizerId ?? user.id,
            status: 'upcoming',
        })
        return { success: true, data: activity, state: ACTIVITY.CREATE_SUCCESS }
    }

    static async list(data: ListActivitiesInput): Promise<PaginatedActivityResponse<ActivityWithOrganizer>> {
        const items = await activityQueries.list(data)
        const total = await activityQueries.count(data)
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }

    static async getById(data: ActivityIdInput): Promise<ActivityResponse<ActivityWithOrganizer>> {
        const activity = await activityQueries.findById(data)
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        return { success: true, data: activity, state: ACTIVITY.GET_SUCCESS }
    }

    static async update(data: UpdateActivityInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById({ id: data.id })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        if (activity.organizerId !== user.id && user.role !== 'admin') return { success: false, state: ACTIVITY.FORBIDDEN }
        await activityQueries.update(data)
        return { success: true, state: ACTIVITY.UPDATE_SUCCESS }
    }

    static async delete(data: ActivityIdInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById(data)
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        if (activity.organizerId !== user.id && user.role !== 'admin') return { success: false, state: ACTIVITY.FORBIDDEN }
        await activityQueries.delete(data)
        return { success: true, state: ACTIVITY.DELETE_SUCCESS }
    }

    static async register(data: RegisterActivityInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById({ id: data.activityId })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        const existing = await activityQueries.findParticipant({ ...data, userId: user.id })
        if (existing && existing.status !== 'cancelled') return { success: false, state: ACTIVITY.ALREADY_REGISTERED }
        if (activity.maxParticipants) {
            const count = await activityQueries.countParticipants(activity.id)
            if (count >= activity.maxParticipants) return { success: false, state: ACTIVITY.FULL }
        }
        await activityQueries.createParticipant({ activityId: activity.id, userId: user.id, status: 'registered' })
        return { success: true, state: ACTIVITY.REGISTER_SUCCESS }
    }

    static async cancelRegistration(data: ActivityParticipantIdInput): Promise<ActivityResponse<void>> {
        await activityQueries.updateParticipantStatus(data, 'cancelled')
        return { success: true, state: ACTIVITY.CANCEL_SUCCESS }
    }

    static async checkIn(data: ActivityParticipantIdInput): Promise<ActivityResponse<void>> {
        await activityQueries.updateParticipantStatus(data, 'attended')
        return { success: true, state: ACTIVITY.CHECK_IN_SUCCESS }
    }

    static async listParticipants(data: ListActivityParticipantsInput): Promise<PaginatedActivityResponse<ActivityParticipantWithUser>> {
        const items = await activityQueries.listParticipants(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }
}

