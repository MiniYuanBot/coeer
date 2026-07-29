import { and, asc, count, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm'
import { db } from '../client'
import { dormCycles, dormQuestionnaires, dormRooms } from '../schemas'
import type { DormCycleStatus, DormRoomStatus } from '@shared/constants'
import type {
    DormCycleFilterInput,
    DormConfirmInput,
    DormCreateCycleInput,
    DormQuestionnaireInput,
    DormRoomUpdateInput,
    ListDormCyclesInput,
    ListDormRoomsInput,
} from '@shared/contracts'

function buildCycleWhere(data: DormCycleFilterInput & { cycleId?: string }): SQL | undefined {
    const conditions: SQL[] = []
    if (data.cycleId) conditions.push(eq(dormCycles.id, data.cycleId))
    if (data.status) conditions.push(eq(dormCycles.status, data.status))
    if (data.search) {
        const search = or(
            ilike(dormCycles.code, `%${data.search}%`),
            ilike(dormCycles.label, `%${data.search}%`),
            ilike(dormCycles.cohortLabel, `%${data.search}%`),
        )
        if (search) conditions.push(search)
    }
    return conditions.length ? and(...conditions) : undefined
}

export const dormQueries = {
    async createCycle(data: DormCreateCycleInput & { status?: DormCycleStatus }) {
        const [cycle] = await db.insert(dormCycles).values({
            ...data,
            status: data.status ?? 'collecting',
        }).returning()
        if (!cycle) throw new Error('Create dorm cycle failed')
        return cycle
    },

    async updateCycleStatus(cycleId: string, status: DormCycleStatus, confirmedAt?: Date | null) {
        const [cycle] = await db.update(dormCycles)
            .set({ status, confirmedAt: confirmedAt ?? undefined, updatedAt: new Date() })
            .where(eq(dormCycles.id, cycleId))
            .returning()
        if (!cycle) throw new Error('Dorm cycle not found')
        return cycle
    },

    async listCycles(data: ListDormCyclesInput) {
        return db.query.dormCycles.findMany({
            where: buildCycleWhere(data),
            orderBy: [desc(dormCycles.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async countCycles(data: DormCycleFilterInput) {
        const [result] = await db.select({ value: count() }).from(dormCycles).where(buildCycleWhere(data))
        return result?.value ?? 0
    },

    async findCycleById(cycleId: string) {
        return db.query.dormCycles.findFirst({ where: eq(dormCycles.id, cycleId) })
    },

    async findActiveCycle() {
        return db.query.dormCycles.findFirst({
            where: inArray(dormCycles.status, ['collecting', 'computed', 'confirmed']),
            orderBy: [desc(dormCycles.createdAt)],
        })
    },

    async upsertQuestionnaire(data: DormQuestionnaireInput & { userId: string }) {
        const existing = await db.query.dormQuestionnaires.findFirst({
            where: and(eq(dormQuestionnaires.cycleId, data.cycleId), eq(dormQuestionnaires.userId, data.userId)),
        })

        if (existing) {
            const [updated] = await db.update(dormQuestionnaires)
                .set({
                    cohortLabel: data.cohortLabel,
                    studentNo: data.studentNo ?? null,
                    gender: data.gender,
                    college: data.college ?? null,
                    major: data.major ?? null,
                    height: data.height ?? null,
                    specialNeeds: data.specialNeeds ?? {},
                    answers: data.answers,
                    updatedAt: new Date(),
                })
                .where(eq(dormQuestionnaires.id, existing.id))
                .returning()
            if (!updated) throw new Error('Update dorm questionnaire failed')
            return updated
        }

        const [created] = await db.insert(dormQuestionnaires).values({
            cycleId: data.cycleId,
            userId: data.userId,
            cohortLabel: data.cohortLabel,
            studentNo: data.studentNo ?? null,
            gender: data.gender,
            college: data.college ?? null,
            major: data.major ?? null,
            height: data.height ?? null,
            specialNeeds: data.specialNeeds ?? {},
            answers: data.answers,
        }).returning()
        if (!created) throw new Error('Create dorm questionnaire failed')
        return created
    },

    async findQuestionnaire(data: { cycleId: string; userId: string }) {
        return db.query.dormQuestionnaires.findFirst({
            where: and(eq(dormQuestionnaires.cycleId, data.cycleId), eq(dormQuestionnaires.userId, data.userId)),
        })
    },

    async listQuestionnairesByCycle(cycleId: string) {
        return db.query.dormQuestionnaires.findMany({
            where: eq(dormQuestionnaires.cycleId, cycleId),
            orderBy: [asc(dormQuestionnaires.createdAt)],
            with: {
                user: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })
    },

    async listQuestionnairesSummaryByCycle(cycleId: string) {
        return this.listQuestionnairesByCycle(cycleId)
    },

    async countQuestionnaires(cycleId: string) {
        const [result] = await db.select({ value: count() }).from(dormQuestionnaires).where(eq(dormQuestionnaires.cycleId, cycleId))
        return result?.value ?? 0
    },

    async replaceRooms(cycleId: string, rooms: Array<{
        roomCode: string
        building?: string | null
        floor?: number | null
        poolTag: string
        members: string[]
        capacity: number
        avgScore: number
        status: 'draft' | 'committed' | 'adjusted'
    }>) {
        await db.delete(dormRooms).where(eq(dormRooms.cycleId, cycleId))
        if (!rooms.length) return []
        return db.insert(dormRooms).values(rooms.map((room) => ({ ...room, cycleId }))).returning()
    },

    async listRooms(data: ListDormRoomsInput) {
        return db.query.dormRooms.findMany({
            where: eq(dormRooms.cycleId, data.cycleId),
            orderBy: [asc(dormRooms.roomCode)],
        })
    },

    async findRoomById(roomId: string) {
        return db.query.dormRooms.findFirst({ where: eq(dormRooms.id, roomId) })
    },

    async updateRoom(data: DormRoomUpdateInput) {
        const [room] = await db.update(dormRooms)
            .set({
                roomCode: data.roomCode,
                building: data.building ?? undefined,
                floor: data.floor ?? undefined,
                members: data.members,
                status: 'adjusted',
                updatedAt: new Date(),
            })
            .where(and(eq(dormRooms.id, data.roomId), eq(dormRooms.cycleId, data.cycleId)))
            .returning()
        if (!room) throw new Error('Dorm room not found')
        return room
    },

    async setRoomsStatus(cycleId: string, status: DormRoomStatus) {
        await db.update(dormRooms)
            .set({ status, updatedAt: new Date() })
            .where(eq(dormRooms.cycleId, cycleId))
    },

    async clearRooms(cycleId: string) {
        await db.delete(dormRooms).where(eq(dormRooms.cycleId, cycleId))
    },

    async countRooms(cycleId: string) {
        const [result] = await db.select({ value: count() }).from(dormRooms).where(eq(dormRooms.cycleId, cycleId))
        return result?.value ?? 0
    },
}
