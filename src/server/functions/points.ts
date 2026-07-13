import { createServerFn } from '@tanstack/react-start'
import { PointHistorySchema } from '@shared/contracts'
import { PointService } from '../services'

export const getMyPointBalanceFn = createServerFn({ method: 'GET' })
    .handler(async () => PointService.getBalance())

export const getMyPointHistoryFn = createServerFn({ method: 'GET' })
    .inputValidator(PointHistorySchema)
    .handler(async ({ data }) => PointService.getHistory(data))

