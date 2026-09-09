import { activityQueries, groupMemberQueries } from '../database/queries'
import { ACTIVITY, GROUP_MEMBER_ROLE } from '@shared/constants'
import { AuthService } from './AuthService'
import type { Activity } from '../database/schemas'
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

type SessionUser = NonNullable<Awaited<ReturnType<typeof AuthService.getCurrentUser>>['data']>

export class ActivityService {
    /**
     * Who may manage (update / delete / check-in) an activity:
     * - platform admins
     * - the user-organizer of a `user` activity
     * - a group admin of the organizing group for `group` activities
     */
    private static async canManage(activity: Activity, user: SessionUser): Promise<boolean> {
        if (user.role === 'admin') return true
        if (activity.organizerType === 'group') {
            return groupMemberQueries.checkRole({
                groupId: activity.organizerId,
                userId: user.id,
                role: GROUP_MEMBER_ROLE.ADMIN,
            })
        }
        return activity.organizerId === user.id
    }

    static async create(data: CreateActivityInput): Promise<ActivityResponse<ActivityWithOrganizer>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }

        // Authorization rules for the organizer target (server-side only —
        // organizerType/organizerId coming from the client were previously
        // trusted, letting students forge "official" events):
        const organizerType = data.organizerType ?? 'user'
        const organizerId = data.organizerId ?? user.id

        if (data.type === 'official' && user.role !== 'admin') {
            return { success: false, state: ACTIVITY.FORBIDDEN }
        }

        if (organizerType === 'group') {
            // A group activity must be organized by a group whose admin is the caller.
            const isGroupAdmin = await groupMemberQueries.checkRole({
                groupId: organizerId,
                userId: user.id,
                role: GROUP_MEMBER_ROLE.ADMIN,
            })
            if (!isGroupAdmin) {
                return { success: false, state: ACTIVITY.FORBIDDEN }
            }
        } else if (organizerId !== user.id && user.role !== 'admin') {
            // Users may only create activities attributed to themselves.
            return { success: false, state: ACTIVITY.FORBIDDEN }
        }

        const activity = await activityQueries.create({
            ...data,
            organizerType,
            organizerId,
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
        if (!(await ActivityService.canManage(activity, user))) return { success: false, state: ACTIVITY.FORBIDDEN }
        await activityQueries.update(data)
        return { success: true, state: ACTIVITY.UPDATE_SUCCESS }
    }

    static async delete(data: ActivityIdInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById(data)
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        if (!(await ActivityService.canManage(activity, user))) return { success: false, state: ACTIVITY.FORBIDDEN }
        await activityQueries.delete(data)
        return { success: true, state: ACTIVITY.DELETE_SUCCESS }
    }

    static async register(data: RegisterActivityInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById({ id: data.activityId })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        if (activity.status !== 'upcoming') {
            return { success: false, state: { ...ACTIVITY.FORBIDDEN, message: '活动不在报名期内' } }
        }
        const existing = await activityQueries.findParticipant({ ...data, userId: user.id })
        if (existing && existing.status !== 'cancelled') return { success: false, state: ACTIVITY.ALREADY_REGISTERED }
        if (activity.maxParticipants) {
            const count = await activityQueries.countParticipants(activity.id)
            if (count >= activity.maxParticipants) return { success: false, state: ACTIVITY.FULL }
        }
        await activityQueries.createParticipant({ activityId: activity.id, userId: user.id, status: 'registered' })
        return { success: true, state: ACTIVITY.REGISTER_SUCCESS }
    }

    // Cancel one's own registration (or an organizer/admin cancelling it).
    static async cancelRegistration(data: ActivityParticipantIdInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }

        const participant = await activityQueries.findParticipantById(data.participantId)
        if (!participant) return { success: false, state: ACTIVITY.NOT_FOUND }

        const activity = await activityQueries.findById({ id: participant.activityId })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }

        if (participant.userId !== user.id && !(await ActivityService.canManage(activity, user))) {
            return { success: false, state: ACTIVITY.FORBIDDEN }
        }

        await activityQueries.updateParticipantStatus(data, 'cancelled')
        return { success: true, state: ACTIVITY.CANCEL_SUCCESS }
    }

    // Mark attendance — organizers/admins only (previously unauthenticated).
    static async checkIn(data: ActivityParticipantIdInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }

        const participant = await activityQueries.findParticipantById(data.participantId)
        if (!participant) return { success: false, state: ACTIVITY.NOT_FOUND }

        const activity = await activityQueries.findById({ id: participant.activityId })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }

        if (!(await ActivityService.canManage(activity, user))) {
            return { success: false, state: ACTIVITY.FORBIDDEN }
        }

        await activityQueries.updateParticipantStatus(data, 'attended')
        return { success: true, state: ACTIVITY.CHECK_IN_SUCCESS }
    }

    static async listParticipants(data: ListActivityParticipantsInput): Promise<PaginatedActivityResponse<ActivityParticipantWithUser>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }

        const activity = await activityQueries.findById({ id: data.activityId })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }

        // Participant rosters are private to the organizers.
        if (!(await ActivityService.canManage(activity, user))) {
            return { success: false, state: ACTIVITY.FORBIDDEN }
        }

        const items = await activityQueries.listParticipants(data)
        return { success: true, data: { items, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }
}
