import { createServerFn } from '@tanstack/react-start'
import { UserService } from '../services'

export const getUserStatsFn = createServerFn({ method: 'GET' })
    .handler(async () => UserService.getStats())
