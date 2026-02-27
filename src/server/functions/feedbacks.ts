import { createServerFn } from '@tanstack/react-start'
import { FeedbackService } from '../services/FeedbackService'
import {
    CreateFeedbackSchema,
    UpdateFeedbackStatusSchema,
} from '@shared/contracts'
import { FeedbackStatus } from '@shared/constants'
import { z } from 'zod'

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
    .inputValidator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await FeedbackService.getById(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get all feedbacks with optional filters
export const getFeedbacksFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        status?: FeedbackStatus;
        search?: string;
        page?: number;
        pageSize?: number
    }) => data)
    .handler(async ({ data }) => {
        const result = await FeedbackService.list({
            status: data.status,
            search: data.search,
            page: data.page || 1,
            pageSize: data.pageSize || 20,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Update a feedback
export const updateFeedbackStatusFn = createServerFn({ method: 'POST' })
    .inputValidator(UpdateFeedbackStatusSchema)
    .handler(async ({ data }) => {
        const { id, status, note } = data
        const result = await FeedbackService.updateStatus(id, { status, note })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Delete a feedback
export const deleteFeedbackFn = createServerFn({ method: 'POST' })
    .inputValidator((data: { id: string }) => z.object({ id: z.string() }).parse(data))
    .handler(async ({ data }) => {
        const result = await FeedbackService.delete(data.id)

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Get feedback's change log
export const getFeedbackStatusLogsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        feedbackId: string;
        page?: number;
        pageSize?: number
    }) => z.object({
        feedbackId: z.string(),
        page: z.number().optional(),
        pageSize: z.number().optional()
    }).parse(data))
    .handler(async ({ data }) => {
        const result = await FeedbackService.getStatusLogs(data.feedbackId, {
            page: data.page || 1,
            pageSize: data.pageSize || 20,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })

// Gat feedback statistics
export const getFeedbackStatsFn = createServerFn({ method: 'GET' })
    .inputValidator((data: {
        startDate?: string;
        endDate?: string
    }) => data)
    .handler(async ({ data }) => {
        const result = await FeedbackService.getStats({
            startDate: data.startDate,
            endDate: data.endDate,
        })

        if (!result.success) {
            throw new Error(result.state.message)
        }

        return result.data
    })