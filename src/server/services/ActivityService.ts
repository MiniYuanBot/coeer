import { activityQueries, groupMemberQueries } from '../database/queries'
import { ACTIVITY, GROUP_MEMBER_ROLE } from '@shared/constants'
import { AuthService } from './AuthService'
import { db } from '../database/client'
import { activities, activityParticipants } from '../database/schemas'
import { and, count, eq, ne } from 'drizzle-orm'
import { activityStatusAt } from '@shared/activities'
import { NotificationService } from './NotificationService'
import { EngagementService } from './EngagementService'
import { pointQueries } from '../database/queries/points'
import { studentIdForUser } from '@shared/contracts/auth'
import type { Activity } from '../database/schemas'
import type {
    ActivityIdInput,
    AdminActivityParticipant,
    AdminListActivityParticipantsInput,
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
    static async adminListParticipants(data: AdminListActivityParticipantsInput): Promise<PaginatedActivityResponse<AdminActivityParticipant>> {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        if (current.data.role !== 'admin') return { success: false, state: ACTIVITY.FORBIDDEN }
        const [items, total] = await Promise.all([activityQueries.listAllParticipants(data), activityQueries.countAllParticipants(data)])
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }

    private static async withParticipation(items: ActivityWithOrganizer[], userId?: string): Promise<ActivityWithOrganizer[]> {
        const participations = userId ? await activityQueries.findParticipationsForUser(items.map((item) => item.id), userId) : []
        const byActivity = new Map(participations.map(({ activityId, id, status }) => [activityId, { id, status }]))
        return items.map((item) => ({ ...item, myParticipation: byActivity.get(item.id) ?? null }))
    }
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

        if (data.endTime <= data.startTime) return { success: false, state: { ...ACTIVITY.FORBIDDEN, message: '结束时间必须晚于开始时间' } }
        const activity = await activityQueries.create({
            ...data,
            organizerType,
            organizerId,
            status: activityStatusAt({ ...data, status: 'upcoming' }),
        })
        return { success: true, data: activity, state: ACTIVITY.CREATE_SUCCESS }
    }

    static async list(data: ListActivitiesInput): Promise<PaginatedActivityResponse<ActivityWithOrganizer>> {
        const current = await AuthService.getCurrentUser()
        const items = await activityQueries.list(data)
        const total = await activityQueries.count(data)
        return { success: true, data: { items: await this.withParticipation(items, current.success ? current.data?.id : undefined), total, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }

    static async getById(data: ActivityIdInput): Promise<ActivityResponse<ActivityWithOrganizer>> {
        const activity = await activityQueries.findById(data)
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        const current = await AuthService.getCurrentUser()
        const [item] = await this.withParticipation([activity], current.success ? current.data?.id : undefined)
        return { success: true, data: item, state: ACTIVITY.GET_SUCCESS }
    }

    static async update(data: UpdateActivityInput): Promise<ActivityResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: ACTIVITY.UNAUTHORIZED }
        const activity = await activityQueries.findById({ id: data.id })
        if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
        if (!(await ActivityService.canManage(activity, user))) return { success: false, state: ACTIVITY.FORBIDDEN }
        const updated = { ...activity, ...data }
        if (updated.endTime <= updated.startTime) return { success: false, state: { ...ACTIVITY.FORBIDDEN, message: '结束时间必须晚于开始时间' } }
        await activityQueries.update({ ...data, status: activityStatusAt(updated) })
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
        return db.transaction(async (tx) => {
            const [activity] = await tx.select().from(activities).where(eq(activities.id, data.activityId)).for('update')
            if (!activity) return { success: false, state: ACTIVITY.NOT_FOUND }
            if (activityStatusAt(activity) !== 'upcoming') return { success: false, state: { ...ACTIVITY.FORBIDDEN, message: '活动不在报名期内' } }
            const [existing] = await tx.select().from(activityParticipants).where(and(eq(activityParticipants.activityId, activity.id), eq(activityParticipants.userId, user.id)))
            if (existing && existing.status !== 'cancelled') return { success: true, state: ACTIVITY.ALREADY_REGISTERED }
            const [total] = await tx.select({ value: count() }).from(activityParticipants).where(and(eq(activityParticipants.activityId, activity.id), ne(activityParticipants.status, 'cancelled')))
            if (activity.maxParticipants && total.value >= activity.maxParticipants) return { success: false, state: ACTIVITY.FULL }
            if (existing) await tx.update(activityParticipants).set({ status: 'registered', registeredAt: new Date() }).where(eq(activityParticipants.id, existing.id))
            else await tx.insert(activityParticipants).values({ activityId: activity.id, userId: user.id, status: 'registered' })
            await NotificationService.create({
                userId: user.id, type: 'activity_registration', title: '活动报名成功',
                content: `你已成功报名「${activity.title}」。开始时间：${activity.startTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}；地点：${activity.location || '待定'}。`,
                href: `/activities/${activity.id}`,
            }, tx)
            return { success: true, state: ACTIVITY.REGISTER_SUCCESS }
        })
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

        await db.transaction(async (tx) => {
            await pointQueries.lockUser(participant.userId, tx)
            await activityQueries.updateParticipantStatus(data, 'attended', tx)
            await EngagementService.recordInTx(participant.userId, 'attendance', participant.activityId, tx)
        })
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

        const [items, total] = await Promise.all([activityQueries.listParticipants(data), activityQueries.countRoster(data)])
        return { success: true, data: { items: items.map(({ user: participantUser, ...participant }) => ({
            ...participant,
            user: participantUser ? { id: participantUser.id, name: participantUser.name, studentId: studentIdForUser(participantUser) } : null,
        })), total, limit: data.limit, offset: data.offset }, state: ACTIVITY.GET_SUCCESS }
    }
}
