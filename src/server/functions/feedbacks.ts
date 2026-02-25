import { createServerFn } from '@tanstack/react-start'
import { FeedbackService } from '../services'
import { FeedbackStatuses } from '@shared/constants'

export const getFeedbacksFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        status?: FeedbackStatuses;
        search?: string;
        page?: number;
        pageSize?: number;
    }) => data)
    .handler(async ({ data }) => {
        const result = await FeedbackService.list({
            status: data.status,
            search: data.search,
            page: data.page || 1,
            pageSize: data.pageSize || 50,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })
