import { createServerFn } from '@tanstack/react-start'
import { setResponseHeader } from '@tanstack/react-start/server'
import { HomeService } from '../services/HomeService'

export const getHomeFn = createServerFn({ method: 'GET' }).handler(async () => {
    const result = await HomeService.load()
    setResponseHeader('Server-Timing', result.timing)
    setResponseHeader('Cache-Control', 'private, no-store')
    return result.data
})
