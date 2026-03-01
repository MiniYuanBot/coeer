import { db } from '../database/client'
import { Feedback, feedbacks, feedbackStatusLogs } from '../database/schemas'
import type {
    FeedbackIdInput,
    CreateFeedbackInput,
    FeedbackWithAuthor,
    FeedbackResponse,
    PaginatedFeedbackResponse,
    UpdateFeedbackStatusInput,
    FeedbackStatusLogWithUser,
    FeedbackStats,
    ListFeedbacksInput,
    ListFeedbackStatusInput,
    FeedbackStatsInput
} from '@shared/contracts'
import { FEEDBACK } from '@shared/constants'
import { AuthService } from './AuthService'
import { feedbackQueries } from '../database/queries'
import { eq, desc, count, and, gte, lte } from 'drizzle-orm'

export class FeedbackService {
    // Create a feedback (records initial status log)
    static async create(data: CreateFeedbackInput): Promise<FeedbackResponse<Feedback>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            const result = await db.transaction(async (tx) => {
                const feedback = await feedbackQueries.create({
                    ...data,
                    authorId: user.id,
                    status: 'pending',
                })

                // Record initial status log
                await tx.insert(feedbackStatusLogs).values({
                    feedbackId: feedback.id,
                    status: 'pending',
                    changedBy: user.id,
                    note: 'Initial submission',
                    createdAt: new Date(),
                })

                return feedback
            })

            return {
                success: true,
                data: result,
                state: FEEDBACK.CREATE_SUCCESS,
            }
        } catch (err) {
            console.error('Create feedback error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // Get feedback details by its id
    static async getById(data: FeedbackIdInput): Promise<FeedbackResponse<FeedbackWithAuthor>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            const feedback = await feedbackQueries.findByIdWithAuthor(data)

            if (!feedback) {
                return { success: false, state: FEEDBACK.NOT_FOUND }
            }

            const isAdmin = user.role === 'admin'
            const isAuthor = feedback.authorId === user.id

            // Permission check: only author or admin can view
            if (!isAdmin && !isAuthor) {
                return { success: false, state: FEEDBACK.FORBIDDEN }
            }

            // // Hide author info for anonymous feedback when viewed by non-admins
            // if (feedback.isAnonymous && !isAdmin) {
            //     feedback.author = undefined
            //     feedback.authorId = undefined
            // }

            return {
                success: true,
                data: feedback as FeedbackWithAuthor,
                state: FEEDBACK.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get feedback error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // List feedbacks with filters
    static async list(data: ListFeedbacksInput): Promise<PaginatedFeedbackResponse<FeedbackWithAuthor>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            const isAdmin = user.role === 'admin'
            const { status, search, limit, offset } = data

            let items: FeedbackWithAuthor[]
            let total: number

            if (isAdmin) {
                // Admin sees all feedbacks
                items = await feedbackQueries.findAll(data) as FeedbackWithAuthor[]

                total = await feedbackQueries.count({ authorId: user.id, status: data.status, search: data.search })
            } else {
                // Regular user sees only their own feedbacks
                items = await feedbackQueries.findByAuthorId(data)

                total = await feedbackQueries.count({
                    status,
                    search,
                    authorId: user.id
                })
            }

            return {
                success: true,
                data: {
                    items,
                    total,
                    limit,
                    offset
                },
                state: FEEDBACK.GET_SUCCESS,
            }
        } catch (err) {
            console.error('List feedbacks error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // Update feedback status (admin only)
    static async updateStatus(data: UpdateFeedbackStatusInput): Promise<FeedbackResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            // Check admin role
            const isAdmin = user.role === 'admin'
            if (!isAdmin) {
                return { success: false, state: FEEDBACK.FORBIDDEN }
            }

            const feedback = await feedbackQueries.findById({ id: data.id })
            if (!feedback) {
                return { success: false, state: FEEDBACK.NOT_FOUND }
            }

            await db.transaction(async (tx) => {
                // Update feedback status
                await feedbackQueries.update({ id: data.id, status: data.status })

                // Record status change log
                await tx.insert(feedbackStatusLogs).values({
                    feedbackId: data.id,
                    status: data.status,
                    changedBy: user.id,
                    note: data.note,
                    createdAt: new Date()
                })
            })

            return {
                success: true,
                data: undefined,
                state: FEEDBACK.UPDATE_SUCCESS
            }
        } catch (err) {
            console.error('Update status error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // Delete a feedback (author or admin only)
    static async delete(data: FeedbackIdInput): Promise<FeedbackResponse<void>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            const feedback = await feedbackQueries.findById(data)
            if (!feedback) {
                return { success: false, state: FEEDBACK.NOT_FOUND }
            }

            const isAdmin = user.role === 'admin'
            const isAuthor = feedback.authorId === user.id

            // Permission check: only author or admin can delete
            if (!isAdmin && !isAuthor) {
                return { success: false, state: FEEDBACK.FORBIDDEN }
            }

            await feedbackQueries.delete(data)

            return {
                success: true,
                data: undefined,
                state: FEEDBACK.DELETE_SUCCESS
            }
        } catch (err) {
            console.error('Delete feedback error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // Get status change logs for a feedback
    static async getStatusLogs(data: ListFeedbackStatusInput): Promise<PaginatedFeedbackResponse<FeedbackStatusLogWithUser>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            const feedback = await feedbackQueries.findById({ id: data.feedbackId })
            if (!feedback) {
                return { success: false, state: FEEDBACK.NOT_FOUND }
            }

            const isAdmin = user.role === 'admin'
            const isAuthor = feedback.authorId === user.id

            // Permission check: only author or admin can view logs
            if (!isAdmin && !isAuthor) {
                return { success: false, state: FEEDBACK.FORBIDDEN }
            }

            const { limit, offset } = data

            // Build query with pagination
            const logsQuery = db.query.feedbackStatusLogs.findMany({
                where: eq(feedbackStatusLogs.feedbackId, data.feedbackId),
                with: isAdmin ? {
                    // Admin sees operator details
                    changedBy: {
                        columns: {
                            id: true,
                            name: true,
                            // avatar: true,
                        },
                    },
                } : undefined,
                orderBy: [desc(feedbackStatusLogs.createdAt)],
                limit,
                offset,
            })

            const countQuery = db.select({ count: count() })
                .from(feedbackStatusLogs)
                .where(eq(feedbackStatusLogs.feedbackId, data.feedbackId))

            const [logs, [{ count: total }]] = await Promise.all([logsQuery, countQuery])

            // For non-admins, hide operator details
            const sanitizedLogs: FeedbackStatusLogWithUser[] = logs.map(log => {
                if (isAdmin && 'changedBy' in log && log.changedBy) {
                    // admin
                    return {
                        id: log.id,
                        createdAt: log.createdAt,
                        status: log.status,
                        feedbackId: log.feedbackId,
                        changedBy: log.changedBy as any,
                        note: log.note
                    }
                } else {
                    // non-admin
                    return {
                        id: log.id,
                        createdAt: log.createdAt,
                        status: log.status,
                        feedbackId: log.feedbackId,
                        changedBy: undefined,
                        note: log.note
                    }
                }
            })

            return {
                success: true,
                data: {
                    items: sanitizedLogs,
                    total: total,
                    limit,
                    offset
                },
                state: FEEDBACK.GET_SUCCESS
            }
        } catch (err) {
            console.error('Get status logs error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }

    // Get feedback statistics for admin dashboard
    static async getStats(data: FeedbackStatsInput): Promise<FeedbackResponse<FeedbackStats>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, state: FEEDBACK.UNAUTHORIZED }
            }

            // Only admin can view statistics
            const isAdmin = user.role === 'admin'
            if (!isAdmin) {
                return { success: false, state: FEEDBACK.FORBIDDEN }
            }

            const { startDate, endDate } = data

            // Build date filter conditions
            const conditions = []
            if (startDate) {
                conditions.push(gte(feedbacks.createdAt, new Date(startDate)))
            }
            if (endDate) {
                conditions.push(lte(feedbacks.createdAt, new Date(endDate)))
            }

            const whereClause = conditions.length > 0 ? and(...conditions) : undefined

            // Get status distribution
            const statusStats = await db
                .select({
                    status: feedbacks.status,
                    count: count(),
                })
                .from(feedbacks)
                .where(whereClause)
                .groupBy(feedbacks.status)

            // Calculate totals
            const result: FeedbackStats = {
                total: 0,
                pending: 0,
                processing: 0,
                resolved: 0,
                invalid: 0,
                avgResolveTime: 0,
            }

            statusStats.forEach(stat => {
                result.total += Number(stat.count)
                if (stat.status in result) {
                    result[stat.status as keyof Omit<FeedbackStats, 'avgResponseTime'>] = Number(stat.count)
                }
            })

            // Calculate average response time (resolved feedbacks only)
            // Average time from creation to resolution
            const resolvedFeedbacks = await db.query.feedbacks.findMany({
                where: and(
                    eq(feedbacks.status, 'resolved'),
                    whereClause
                ),
                columns: {
                    createdAt: true,
                    updatedAt: true,
                }
            })

            if (resolvedFeedbacks.length > 0) {
                const totalResponseTime = resolvedFeedbacks.reduce((sum, fb) => {
                    const created = new Date(fb.createdAt).getTime()
                    const resolved = new Date(fb.updatedAt).getTime()
                    return sum + (resolved - created)
                }, 0)

                // Average in hours
                result.avgResolveTime = Math.round(totalResponseTime / resolvedFeedbacks.length / (1000 * 60 * 60))
            }

            return {
                success: true,
                data: result,
                state: FEEDBACK.GET_SUCCESS
            }
        } catch (err) {
            console.error('Get stats error:', err)
            return { success: false, state: FEEDBACK.SERVER_ERROR }
        }
    }
}