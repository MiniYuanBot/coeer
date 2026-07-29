import { dormQueries } from '../database/queries/dorms'
import { AuthService } from './AuthService'
import { DORM } from '@shared/constants'
import type {
    DormAdminOverview,
    DormConfirmInput,
    DormCreateCycleInput,
    DormCycle,
    DormQuestionnaire,
    DormQuestionnaireAnswers,
    DormQuestionnaireSummary,
    DormQuestionnaireInput,
    DormSpecialNeeds,
    DormRoom,
    DormRoomUpdateInput,
    DormStudentView,
    DormStudentResponse,
    PaginatedDormResponse,
    ListDormCyclesInput,
} from '@shared/contracts'
import { getDormQuestionConfig } from '../utils/dormQuestionConfig'

type DormQuestionConfig = ReturnType<typeof getDormQuestionConfig>[number]
type DbDormQuestionnaire = Awaited<ReturnType<typeof dormQueries.findQuestionnaire>>
type DbDormQuestionnaireListItem = Awaited<ReturnType<typeof dormQueries.listQuestionnairesByCycle>>[number]
type DbDormRoom = Awaited<ReturnType<typeof dormQueries.listRooms>>[number]
type DbDormCycle = Awaited<ReturnType<typeof dormQueries.findCycleById>>

function toIso<T extends { createdAt?: Date | string; updatedAt?: Date | string; confirmedAt?: Date | string | null }>(item: T) {
    return {
        ...item,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
        confirmedAt: item.confirmedAt instanceof Date ? item.confirmedAt.toISOString() : item.confirmedAt ?? null,
    }
}

function mapCycle(cycle: NonNullable<DbDormCycle>) {
    return toIso(cycle) as DormCycle
}

function mapQuestionnaire(questionnaire: NonNullable<DbDormQuestionnaire>): DormQuestionnaire {
    const item = toIso(questionnaire)
    return {
        id: item.id,
        cycleId: item.cycleId,
        userId: item.userId,
        cohortLabel: item.cohortLabel,
        studentNo: item.studentNo,
        gender: item.gender,
        college: item.college,
        major: item.major,
        height: item.height,
        specialNeeds: (item.specialNeeds ?? {}) as Record<string, string | number | boolean | null>,
        answers: (item.answers ?? {}) as DormQuestionnaireAnswers,
        submittedAt: (item.createdAt ?? new Date().toISOString()) as string,
        updatedAt: (item.updatedAt ?? new Date().toISOString()) as string,
    }
}

function mapQuestionnaireSummary(item: DbDormQuestionnaireListItem): DormQuestionnaireSummary {
    const questionnaire = mapQuestionnaire(item)
    return {
        ...questionnaire,
        user: item.user ? { id: item.user.id, name: item.user.name, email: item.user.email } : null,
    }
}

function mapRoom(room: DbDormRoom): DormRoom {
    return toIso(room) as DormRoom
}

function compatScalar(a: any, b: any) {
    const diff = Math.abs(Number(a) - Number(b))
    return Math.max(0, 5 - diff)
}

function compatMulti(a: any, b: any) {
    const sa = new Set(Array.isArray(a) ? a : [a])
    const sb = new Set(Array.isArray(b) ? b : [b])
    const inter = [...sa].filter((x) => sb.has(x)).length
    const union = new Set([...sa, ...sb]).size
    return union ? (inter / union) * 5 : 0
}

function scoreValue(cfg: DormQuestionConfig, left: any, right: any) {
    if (left == null || right == null) return 2.5
    if (!cfg.active || cfg.weight <= 0) return 0
    if (cfg.value_type === 'multi') return compatMulti(left, right)
    if (cfg.value_type === 'string') return left === right ? 5 : 1
    return compatScalar(left, right)
}

function getPoolTag(input: { gender: string; specialNeeds?: DormSpecialNeeds; height?: number | null }) {
    const tags = []
    if (input.specialNeeds?.extra_long_bed || (input.height ?? 0) > 190) tags.push('longbed')
    if (input.specialNeeds?.low_floor) tags.push('lowfloor')
    if (input.specialNeeds?.barrier_free) tags.push('barrierfree')
    if (input.specialNeeds?.medical) tags.push('medical')
    return `${input.gender}-${tags.length ? tags.join('-') : 'normal'}`
}

export class DormService {
    static async listCycles(data: ListDormCyclesInput): Promise<PaginatedDormResponse<DormCycle>> {
        const items = await dormQueries.listCycles(data)
        const total = await dormQueries.countCycles({ status: data.status, search: data.search })
        return { success: true, data: { items: items.map((item) => mapCycle(item)), total, limit: data.limit, offset: data.offset }, state: DORM.GET_SUCCESS }
    }

    static async createCycle(data: DormCreateCycleInput): Promise<DormStudentResponse<DormCycle>> {
        const payload = await AuthService.getCurrentUser()
        if (!payload.success || payload.data?.role !== 'admin') return { success: false, state: DORM.FORBIDDEN }
        const cycle = await dormQueries.createCycle({ ...data, status: 'collecting' })
        return { success: true, data: mapCycle(cycle), state: DORM.CREATE_SUCCESS }
    }

    static async getStudentView(cycleId?: string): Promise<DormStudentResponse<DormStudentView>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: DORM.UNAUTHORIZED }
        const cycle = cycleId ? await dormQueries.findCycleById(cycleId) : await dormQueries.findActiveCycle()
        if (!cycle) return { success: true, data: { status: 'waiting', cycle: null, questionnaire: null, room: null }, state: DORM.WAITING }
        const questionnaire = await dormQueries.findQuestionnaire({ cycleId: cycle.id, userId: user.id })
        const room = cycle.status === 'confirmed' && questionnaire ? (await dormQueries.listRooms({ cycleId: cycle.id })).find((item) => item.members.includes(user.id)) : null
        const status = cycle.status === 'confirmed' ? 'confirmed' : 'waiting'
        return { success: true, data: { cycle: mapCycle(cycle), questionnaire: questionnaire ? mapQuestionnaire(questionnaire) : null, room: room ? mapRoom(room) : null, status, cohortLabel: cycle.cohortLabel }, state: DORM.GET_SUCCESS }
    }

    static async submitQuestionnaire(data: DormQuestionnaireInput): Promise<DormStudentResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { success: false, state: DORM.UNAUTHORIZED }
        const cycle = await dormQueries.findCycleById(data.cycleId)
        if (!cycle) return { success: false, state: DORM.NOT_FOUND }
        await dormQueries.upsertQuestionnaire({ ...data, userId: user.id })
        return { success: true, state: DORM.UPDATE_SUCCESS }
    }

    static async getAdminOverview(data: { cycleId?: string } = {}): Promise<DormStudentResponse<DormAdminOverview>> {
        const payload = await AuthService.getCurrentUser()
        if (!payload.success || payload.data?.role !== 'admin') return { success: false, state: DORM.FORBIDDEN }
        const cycles = await dormQueries.listCycles({ limit: 50, offset: 0 })
        const enriched = await Promise.all(cycles.map(async (cycle) => ({
            ...mapCycle(cycle),
            questionnaireCount: await dormQueries.countQuestionnaires(cycle.id),
            roomCount: await dormQueries.countRooms(cycle.id),
            confirmedRoomCount: (await dormQueries.listRooms({ cycleId: cycle.id })).filter((room) => room.status === 'committed').length,
        })))
        const activeCycle = data.cycleId ? enriched.find((cycle) => cycle.id === data.cycleId) ?? null : enriched[0] ?? null
        const rooms = activeCycle ? await dormQueries.listRooms({ cycleId: activeCycle.id }) : []
        const submissions = activeCycle ? await dormQueries.listQuestionnairesByCycle(activeCycle.id) : []
        return {
            success: true,
            data: {
                cycles: enriched,
                activeCycle,
                rooms: rooms.map((item) => mapRoom(item)),
                submissions: submissions.map((item) => mapQuestionnaireSummary(item)),
                questionnaireCount: activeCycle?.questionnaireCount ?? 0,
                unassignedCount: Math.max(0, (activeCycle?.questionnaireCount ?? 0) - rooms.reduce((sum, room) => sum + room.members.length, 0)),
            },
            state: DORM.GET_SUCCESS,
        }
    }

    static async compute(data: DormConfirmInput): Promise<DormStudentResponse<DormRoom[]>> {
        const payload = await AuthService.getCurrentUser()
        if (!payload.success || payload.data?.role !== 'admin') return { success: false, state: DORM.FORBIDDEN }
        const cycle = await dormQueries.findCycleById(data.cycleId)
        if (!cycle) return { success: false, state: DORM.NOT_FOUND }

        const questionnaires = await dormQueries.listQuestionnairesByCycle(data.cycleId)
        const questionConfig = getDormQuestionConfig().filter((item) => item.active && item.weight > 0)
        const students = questionnaires.map((item) => ({
            ...mapQuestionnaire(item),
            poolTag: getPoolTag({
                gender: item.gender,
                specialNeeds: (item.specialNeeds || {}) as Record<string, string | number | boolean | null>,
                height: item.height,
            }),
        }))

        const groups = new Map<string, typeof students>()
        for (const item of students) {
            const list = groups.get(item.poolTag) ?? []
            list.push(item)
            groups.set(item.poolTag, list)
        }

        const builtRooms: Array<{ roomCode: string; building?: string | null; floor?: number | null; poolTag: string; members: string[]; capacity: number; avgScore: number; status: 'draft' | 'committed' | 'adjusted' }> = []

        for (const [poolTag, poolStudents] of groups.entries()) {
            const order = [...poolStudents]
            while (order.length) {
                const seed = order.shift()!
                const roomMembers = [seed]
                while (roomMembers.length < 4 && order.length) {
                    let bestIndex = 0
                    let bestScore = -1
                    for (let i = 0; i < order.length; i++) {
                        const candidate = order[i]
                        const score = roomMembers.reduce((sum, member) => {
                            return sum + questionConfig.reduce((acc, cfg) => acc + scoreValue(cfg, member.answers?.[cfg.qid], candidate.answers?.[cfg.qid]), 0)
                        }, 0)
                        if (score > bestScore) {
                            bestScore = score
                            bestIndex = i
                        }
                    }
                    roomMembers.push(order.splice(bestIndex, 1)[0])
                }
                const avgScore = roomMembers.length > 1
                    ? Math.round((roomMembers.reduce((sum, member, idx) => sum + roomMembers.slice(idx + 1).reduce((inner, other) => {
                        return inner + questionConfig.reduce((acc, cfg) => acc + scoreValue(cfg, member.answers?.[cfg.qid], other.answers?.[cfg.qid]), 0)
                    }, 0), 0) / Math.max(1, roomMembers.length - 1)) / Math.max(1, questionConfig.length))
                    : 0
                builtRooms.push({
                    roomCode: `${cycle.code}-${poolTag}-${String(builtRooms.length + 1).padStart(3, '0')}`,
                    poolTag,
                    members: roomMembers.map((item) => item.userId),
                    capacity: 4,
                    avgScore,
                    status: 'draft',
                })
            }
        }

        const savedRooms = await dormQueries.replaceRooms(data.cycleId, builtRooms)
        await dormQueries.updateCycleStatus(data.cycleId, 'computed')
        return { success: true, data: savedRooms.map((item) => mapRoom(item)), state: DORM.COMPUTE_SUCCESS }
    }

    static async updateRoom(data: DormRoomUpdateInput): Promise<DormStudentResponse<DormRoom>> {
        const payload = await AuthService.getCurrentUser()
        if (!payload.success || payload.data?.role !== 'admin') return { success: false, state: DORM.FORBIDDEN }
        const room = await dormQueries.updateRoom(data)
        return { success: true, data: mapRoom(room), state: DORM.UPDATE_SUCCESS }
    }

    static async confirm(data: DormConfirmInput): Promise<DormStudentResponse<void>> {
        const payload = await AuthService.getCurrentUser()
        if (!payload.success || payload.data?.role !== 'admin') return { success: false, state: DORM.FORBIDDEN }
        await dormQueries.updateCycleStatus(data.cycleId, 'confirmed', new Date())
        await dormQueries.setRoomsStatus(data.cycleId, 'committed')
        return { success: true, state: DORM.CONFIRM_SUCCESS }
    }
}
