import { createServerFn } from '@tanstack/react-start'
import { FeedbackService } from '../services'
import { FeedbackStatus } from '../database/schemas'

export const getFeedbacksFn = createServerFn({ method: 'GET' })
    .inputValidator((data: { status?: FeedbackStatus; search?: string; page?: number }) => data)
    .handler(async ({ data }) => {
        const result = await FeedbackService.list({
            status: data.status,
            search: data.search,
            page: data.page || 1,
            limit: 50,
        })

        if (!result.success) {
            throw new Error(result.message)
        }

        return result.data
    })
