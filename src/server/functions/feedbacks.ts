import { createServerFn } from '@tanstack/react-start'
import { FeedbackService } from '../services/FeedbackService'
import {
    FeedbackIdSchema,
    CreateFeedbackSchema,
    ListFeedbacksSchema,
    UpdateFeedbackStatusSchema,
    ListFeedbackStatusSchema,
    FeedbackStatsSchema,
} from '@shared/contracts'


// Create a feedback
export const createFeedbackFn = createServerFn({ method: 'POST' })
    .inputValidator(CreateFeedbackSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.create(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get a feedback with author info by its id
export const getFeedbackByIdFn = createServerFn({ method: 'GET' })
    .inputValidator(FeedbackIdSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.getById(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get all feedbacks with optional filters
export const getFeedbacksFn = createServerFn({ method: 'GET' })
    .inputValidator(ListFeedbacksSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.list(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update a feedback
export const updateFeedbackStatusFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateFeedbackStatusSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.updateStatus(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete a feedback
export const deleteFeedbackFn = createServerFn({ method: 'POST' })
    .inputValidator(FeedbackIdSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.delete(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get feedback's change log
export const getFeedbackStatusLogsFn = createServerFn({ method: 'GET' })
    .inputValidator(ListFeedbackStatusSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.getStatusLogs(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Gat feedback statistics
export const getFeedbackStatsFn = createServerFn({ method: 'GET' })
    .inputValidator(FeedbackStatsSchema)
    .handler(async ({ data }) => {
        const result = await FeedbackService.getStats(data)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })