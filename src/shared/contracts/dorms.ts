import { z } from 'zod'
import type { DormCode } from '../constants'
import { DORM_CYCLE_STATUS_ARRAY, DORM_ROOM_STATUS_ARRAY } from '../constants'
import { ActionResponse, PaginatedActionResponse, PaginationSchema } from './shared'
import type { DbUser } from '~/database/schemas'

export const DormCycleIdSchema = z.object({
    cycleId: z.uuid(),
})

export const DormCycleSchema = z.object({
    code: z.string().min(1).max(100),
    label: z.string().min(1).max(100),
    cohortLabel: z.string().min(1).max(100),
    questionnaireVersion: z.string().min(1).max(100).optional(),
})

export const DormSpecialNeedsSchema = z.record(z.string(), z.union([
    z.boolean(),
    z.string(),
    z.number(),
    z.null(),
])).default({})

export const DormQuestionnaireSchema = z.object({
    cycleId: z.uuid(),
    cohortLabel: z.string().min(1).max(100),
    studentNo: z.string().max(50).optional(),
    gender: z.enum(['male', 'female', 'other']),
    college: z.string().max(100).optional(),
    major: z.string().max(100).optional(),
    height: z.number().int().positive().max(250).optional(),
    specialNeeds: DormSpecialNeedsSchema,
    answers: z.record(z.string(), z.union([
        z.string(),
        z.number(),
        z.array(z.union([z.string(), z.number()])),
        z.null(),
    ])),
})

export const DormRoomUpdateSchema = z.object({
    cycleId: z.uuid(),
    roomId: z.uuid(),
    roomCode: z.string().min(1).max(100).optional(),
    building: z.string().max(100).optional().nullable(),
    floor: z.number().int().optional().nullable(),
    members: z.array(z.uuid()).min(1),
})

export const DormConfirmSchema = z.object({
    cycleId: z.uuid(),
})

export const DormViewQuerySchema = z.object({
    cycleId: z.uuid().optional(),
})

export const DormAdminOverviewQuerySchema = z.object({
    cycleId: z.uuid().optional(),
})

export const DormCycleFilterSchema = z.object({
    status: z.enum(DORM_CYCLE_STATUS_ARRAY).optional(),
    search: z.string().optional(),
})

export const ListDormCyclesSchema = z.object({
    ...DormCycleFilterSchema.shape,
    ...PaginationSchema.shape,
})

export const ListDormRoomsSchema = z.object({
    cycleId: z.uuid(),
})

export const DormCycleIdWithQuerySchema = z.object({
    cycleId: z.uuid(),
})

export type DormCycleInput = z.infer<typeof DormCycleSchema>
export type DormQuestionnaireInput = z.infer<typeof DormQuestionnaireSchema>
export type DormRoomUpdateInput = z.infer<typeof DormRoomUpdateSchema>
export type DormConfirmInput = z.infer<typeof DormConfirmSchema>
export type DormViewQueryInput = z.infer<typeof DormViewQuerySchema>
export type DormAdminOverviewQueryInput = z.infer<typeof DormAdminOverviewQuerySchema>
export type DormCreateCycleInput = DormCycleInput
export type DormCycleFilterInput = z.infer<typeof DormCycleFilterSchema>
export type ListDormCyclesInput = z.infer<typeof ListDormCyclesSchema>
export type ListDormRoomsInput = z.infer<typeof ListDormRoomsSchema>

export type DormQuestionnaireAnswer = string | number | Array<string | number> | null
export type DormQuestionnaireAnswers = Record<string, DormQuestionnaireAnswer>
export type DormSpecialNeeds = Record<string, string | number | boolean | null>

export type DormCycle = {
    id: string
    code: string
    label: string
    cohortLabel: string
    questionnaireVersion?: string | null
    status: (typeof DORM_CYCLE_STATUS_ARRAY)[number]
    createdAt: string
    updatedAt: string
    confirmedAt?: string | null
}

export type DormQuestionnaire = {
    id: string
    cycleId: string
    userId: string
    cohortLabel: string
    studentNo?: string | null
    gender: 'male' | 'female' | 'other'
    college?: string | null
    major?: string | null
    height?: number | null
    specialNeeds: DormSpecialNeeds
    answers: DormQuestionnaireAnswers
    submittedAt: string
    updatedAt: string
}

export type DormRoom = {
    id: string
    cycleId: string
    roomCode: string
    building?: string | null
    floor?: number | null
    poolTag: string
    members: string[]
    capacity: number
    avgScore: number
    status: (typeof DORM_ROOM_STATUS_ARRAY)[number]
    createdAt: string
    updatedAt?: string | null
}

export type DormCycleWithStats = DormCycle & {
    questionnaireCount: number
    roomCount: number
    confirmedRoomCount: number
}

export type DormStudentView = {
    cycle?: DormCycle | null
    questionnaire?: DormQuestionnaire | null
    room?: DormRoom | null
    status: 'waiting' | 'collecting' | 'computed' | 'confirmed'
    cohortLabel?: string | null
}

export type DormAdminOverview = {
    cycles: DormCycleWithStats[]
    activeCycle?: DormCycleWithStats | null
    rooms: DormRoom[]
    submissions: DormQuestionnaireSummary[]
    questionnaireCount: number
    unassignedCount: number
}

export type DormQuestionnaireSummary = DormQuestionnaire & {
    user: Pick<DbUser, 'id' | 'name' | 'email'> | null
}

export type DormStudentResponse<T> = ActionResponse<T, DormCode>
export type PaginatedDormResponse<T> = PaginatedActionResponse<T, DormCode>

export type DormCycleWithCreator = DormCycle & {
    creator?: Pick<DbUser, 'id' | 'name' | 'email'> | null
}
