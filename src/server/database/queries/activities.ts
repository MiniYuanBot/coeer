import { and, count, desc, eq, ilike, or, SQL } from 'drizzle-orm'
import { db } from '../client'
import { activities, activityParticipants, NewActivity, NewActivityParticipant } from '../schemas'
import type {
    ActivityIdInput,
    ActivityParticipantIdInput,
    ListActivitiesInput,
    ListActivityParticipantsInput,
    RegisterActivityInput,
    UpdateActivityInput,
} from '@shared/contracts'

function buildActivityWhere(data: ListActivitiesInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.type) conditions.push(eq(activities.type, data.type))
    if (data.organizerType) conditions.push(eq(activities.organizerType, data.organizerType))
    if (data.organizerId) conditions.push(eq(activities.organizerId, data.organizerId))
    if (data.status) conditions.push(eq(activities.status, data.status))
    if (data.search) {
        const searchCondition = or(
            ilike(activities.title, `%${data.search}%`),
            ilike(activities.description, `%${data.search}%`),
            ilike(activities.location, `%${data.search}%`)
        )
        if (searchCondition) conditions.push(searchCondition)
    }
    return conditions.length ? and(...conditions) : undefined
}

export const activityQueries = {
    async create(data: NewActivity) {
        const [activity] = await db.insert(activities).values(data).returning()
        if (!activity) throw new Error('Create activity failed')
        return activity
    },

    async findById(data: ActivityIdInput) {
        return db.query.activities.findFirst({ where: eq(activities.id, data.id) })
    },

    async list(data: ListActivitiesInput) {
        return db.query.activities.findMany({
            where: buildActivityWhere(data),
            orderBy: [desc(activities.startTime)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async update(data: UpdateActivityInput) {
        const [activity] = await db.update(activities)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(activities.id, data.id))
            .returning()
        if (!activity) throw new Error('Activity not found')
        return activity
    },

    async delete(data: ActivityIdInput): Promise<void> {
        await db.delete(activities).where(eq(activities.id, data.id))
    },

    async count(data: ListActivitiesInput): Promise<number> {
        const [result] = await db.select({ value: count() }).from(activities).where(buildActivityWhere(data))
        return result?.value ?? 0
    },

    async createParticipant(data: NewActivityParticipant) {
        const [participant] = await db.insert(activityParticipants).values(data).returning()
        if (!participant) throw new Error('Create participant failed')
        return participant
    },

    async findParticipant(data: RegisterActivityInput & { userId: string }) {
        return db.query.activityParticipants.findFirst({
            where: and(eq(activityParticipants.activityId, data.activityId), eq(activityParticipants.userId, data.userId)),
        })
    },

    async listParticipants(data: ListActivityParticipantsInput) {
        const conditions = [eq(activityParticipants.activityId, data.activityId)]
        if (data.status) conditions.push(eq(activityParticipants.status, data.status))
        return db.query.activityParticipants.findMany({
            where: and(...conditions),
            with: { user: { columns: { id: true, name: true } } },
            limit: data.limit,
            offset: data.offset,
        })
    },

    async updateParticipantStatus(data: ActivityParticipantIdInput, status: 'registered' | 'attended' | 'cancelled') {
        const [participant] = await db.update(activityParticipants)
            .set({ status })
            .where(eq(activityParticipants.id, data.participantId))
            .returning()
        if (!participant) throw new Error('Participant not found')
        return participant
    },

    async countParticipants(activityId: string): Promise<number> {
        const [result] = await db.select({ value: count() }).from(activityParticipants)
            .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.status, 'registered')))
        return result?.value ?? 0
    },
}
