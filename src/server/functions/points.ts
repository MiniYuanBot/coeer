import { createServerFn } from '@tanstack/react-start'
import { PointHistorySchema } from '@shared/contracts'
import { PointService } from '../services'
import { AuthService } from '../services/AuthService'
import { EngagementService } from '../services/EngagementService'

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

