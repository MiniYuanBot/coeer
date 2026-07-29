import { createServerFn } from '@tanstack/react-start'
import { DormService } from '../services/DormService'
import {
    DormConfirmSchema,
    DormCycleSchema,
    DormQuestionnaireSchema,
    DormRoomUpdateSchema,
    ListDormCyclesSchema,
    DormViewQuerySchema,
    DormAdminOverviewQuerySchema,
} from '@shared/contracts'
import { getDormQuestionConfig } from '../utils/dormQuestionConfig'

export const listDormCyclesFn = createServerFn({ method: 'GET' })
    .inputValidator(ListDormCyclesSchema)
    .handler(async ({ data }) => {
        const result = await DormService.listCycles(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const createDormCycleFn = createServerFn({ method: 'POST' })
    .inputValidator(DormCycleSchema)
    .handler(async ({ data }) => {
        const result = await DormService.createCycle(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const getDormStudentViewFn = createServerFn({ method: 'GET' })
    .inputValidator(DormViewQuerySchema)
    .handler(async ({ data }) => {
        const result = await DormService.getStudentView(data.cycleId)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const submitDormQuestionnaireFn = createServerFn({ method: 'POST' })
    .inputValidator(DormQuestionnaireSchema)
    .handler(async ({ data }) => {
        const result = await DormService.submitQuestionnaire(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const getDormAdminOverviewFn = createServerFn({ method: 'GET' })
    .inputValidator(DormAdminOverviewQuerySchema)
    .handler(async ({ data }) => {
        const result = await DormService.getAdminOverview(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const computeDormFn = createServerFn({ method: 'POST' })
    .inputValidator(DormConfirmSchema)
    .handler(async ({ data }) => {
        const result = await DormService.compute(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const updateDormRoomFn = createServerFn({ method: 'POST' })
    .inputValidator(DormRoomUpdateSchema)
    .handler(async ({ data }) => {
        const result = await DormService.updateRoom(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const confirmDormFn = createServerFn({ method: 'POST' })
    .inputValidator(DormConfirmSchema)
    .handler(async ({ data }) => {
        const result = await DormService.confirm(data)
        if (!result.success) throw new Error(result.state.message)
        return result.data
    })

export const getDormQuestionnaireConfigFn = createServerFn({ method: 'GET' })
    .handler(async () => getDormQuestionConfig())
