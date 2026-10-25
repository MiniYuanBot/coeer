import { and, count, desc, eq, ilike, inArray, ne, or, sql, SQL } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { activities, activityParticipants, groups, NewActivity, NewActivityParticipant, type Activity } from '../schemas'
import type {
    ActivityIdInput,
    ActivityParticipantIdInput,
    ListActivitiesInput,
    ListActivityParticipantsInput,
    AdminListActivityParticipantsInput,
    RegisterActivityInput,
    UpdateActivityInput,
} from '@shared/contracts'

// Derive time-based status on reads; listing a page must not UPDATE the whole table.
const effectiveStatus = sql<Activity['status']>`case
    when ${activities.status} in ('cancelled', 'completed') then ${activities.status}
    when ${activities.endTime} <= now() then 'completed'::activity_status
    when ${activities.startTime} <= now() then 'ongoing'::activity_status
    else ${activities.status} end`

function buildActivityWhere(data: ListActivitiesInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.publicOnly) conditions.push(or(
        ne(activities.organizerType, 'group'),
        inArray(activities.organizerId, db.select({ id: groups.id }).from(groups)
            .where(and(eq(groups.isPublic, true), eq(groups.status, 'approved')))),
    )!)
    if (data.type) conditions.push(eq(activities.type, data.type))
    if (data.organizerType) conditions.push(eq(activities.organizerType, data.organizerType))
    if (data.organizerId) conditions.push(eq(activities.organizerId, data.organizerId))
    if (data.status) conditions.push(eq(effectiveStatus, data.status))
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

function buildAdminParticipantWhere(data: AdminListActivityParticipantsInput) {
    return inArray(activityParticipants.activityId, db.select({ id: activities.id }).from(activities).where(and(
        data.type ? eq(activities.type, data.type) : undefined,
        data.search ? ilike(activities.title, `%${data.search.replace(/[\\%_]/g, '\\$&')}%`) : undefined,
    )))
}

export const activityQueries = {
    async listAllParticipants(data: AdminListActivityParticipantsInput) {
        return db.query.activityParticipants.findMany({
            where: buildAdminParticipantWhere(data),
            with: { activity: true, user: { columns: { id: true, name: true } } },
            orderBy: [desc(activityParticipants.registeredAt), desc(activityParticipants.id)],
            limit: data.limit, offset: data.offset,
        })
    },
    async countAllParticipants(data: AdminListActivityParticipantsInput) {
        const [result] = await db.select({ value: count() }).from(activityParticipants).where(buildAdminParticipantWhere(data))
        return result.value
    },
    async findParticipationsForUser(activityIds: string[], userId: string) {
        if (!activityIds.length) return []
        return db.select({ id: activityParticipants.id, activityId: activityParticipants.activityId, status: activityParticipants.status })
            .from(activityParticipants).where(and(inArray(activityParticipants.activityId, activityIds), eq(activityParticipants.userId, userId)))
    },
    async create(data: NewActivity) {
        const [activity] = await db.insert(activities).values(data).returning()
        if (!activity) throw new Error('Create activity failed')
        return activity
    },

    async findById(data: ActivityIdInput) {
        return db.query.activities.findFirst({ where: eq(activities.id, data.id),
            columns: { status: false }, extras: { status: effectiveStatus.as('status') } })
    },

    async list(data: ListActivitiesInput) {
        return db.query.activities.findMany({
            columns: { status: false }, extras: { status: effectiveStatus.as('status') },
            where: buildActivityWhere(data),
            orderBy: [desc(data.sort === 'latest' ? activities.createdAt : activities.startTime), desc(activities.id)],
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

    async findParticipantById(participantId: string) {
        return db.query.activityParticipants.findFirst({
            where: eq(activityParticipants.id, participantId),
        })
    },

    async listParticipants(data: ListActivityParticipantsInput) {
        const conditions = [eq(activityParticipants.activityId, data.activityId)]
        if (data.status) conditions.push(eq(activityParticipants.status, data.status))
        return db.query.activityParticipants.findMany({
            where: and(...conditions),
            with: { user: { columns: { id: true, name: true, email: true, role: true } } },
            orderBy: [desc(activityParticipants.registeredAt), desc(activityParticipants.id)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async countRoster(data: ListActivityParticipantsInput) {
        const [result] = await db.select({ value: count() }).from(activityParticipants).where(and(
            eq(activityParticipants.activityId, data.activityId), data.status ? eq(activityParticipants.status, data.status) : undefined,
        ))
        return result.value
    },

    async updateParticipantStatus(data: ActivityParticipantIdInput, status: 'registered' | 'attended' | 'cancelled', executor: DbExecutor = db) {
        const [participant] = await executor.update(activityParticipants)
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
