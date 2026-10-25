import { createServerFn } from '@tanstack/react-start'
import { PointHistorySchema } from '@shared/contracts'
import { PointService } from '../services'
import { AuthService } from '../services/AuthService'
import { EngagementService } from '../services/EngagementService'
import { AdminPointAdjustmentSchema } from '@shared/contracts/points'
import { z } from 'zod'

export const adjustUserPointsFn = createServerFn({ method: 'POST' }).inputValidator(AdminPointAdjustmentSchema)
    .handler(({ data }) => PointService.adjust(data))

export const getAdminPointBalanceFn = createServerFn({ method: 'GET' }).inputValidator(z.object({ userId: z.uuid() }))
    .handler(async ({ data }) => {
        const current = await AuthService.getCurrentUser()
        if (!current.success || current.data?.role !== 'admin') throw new Error('没有权限')
        return PointService.getBalance(data.userId)
    })

export const getDailyPointTasksFn = createServerFn({ method: 'GET' }).handler(async () => {
    const current = await AuthService.getCurrentUser()
    if (!current.success || !current.data) throw new Error('请先登录')
    return EngagementService.dailyProgress(current.data.id)
})

export const recordDailyVisitFn = createServerFn({ method: 'POST' }).handler(async () => {
    const current = await AuthService.getCurrentUser()
    if (!current.success || !current.data) return null
    return { userId: current.data.id, ...await EngagementService.recordDailyVisit(current.data.id) }
})

export const getMyPointBalanceFn = createServerFn({ method: 'GET' })
    .handler(async () => PointService.getBalance())

export const getMyPointHistoryFn = createServerFn({ method: 'GET' })
    .inputValidator(PointHistorySchema)
    .handler(async ({ data }) => PointService.getHistory(data))

