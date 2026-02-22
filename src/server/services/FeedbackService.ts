import { db } from '../database/client'
import { Feedback } from '../database/schemas'
import type {
    CreateFeedbackData,
    FeedbackWithAuthor,
    FeedbackList,
    FeedbackResponse,
} from '@shared/contracts'
import { FeedbackStatuses } from '@shared/constants'
import { AuthService } from './AuthService'
import { feedbackQueries } from '../database/queries'

export class FeedbackService {
    static async create(data: CreateFeedbackData): Promise<FeedbackResponse<Feedback>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, status: 'UNAUTHORIZED', message: 'Unauthorized user' }
            }

            const result = await db.transaction(async (tx) => {
                const feedback = await feedbackQueries.create({
                    authorId: user.id,
                    targetType: data.targetType,
                    targetDesc: data.targetDesc,
                    title: data.title,
                    content: data.content,
                    isAnonymous: data.isAnonymous,
                    status: 'pending',
                })

                // await tx.insert(feedbackStatusLogs).values({
                //     feedbackId: feedback.id,
                //     status: 'pending',
                //     changedBy: user.id,
                //     note: '初始提交',
                // })

                return feedback
            })

            return {
                success: true,
                data: result,
                status: 'CREATE_SUCCESS',
                message: 'Create feedback successful'
            }
        } catch (err) {
            console.error('Create feedback error:', err)
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }

    static async getById(id: string): Promise<FeedbackResponse<FeedbackWithAuthor>> {
        try {
            const user = await AuthService.getCurrentUser()
            if (!user) {
                return { success: false, status: 'UNAUTHORIZED',  message: 'Unauthorized user'}
            }

            const feedback = await feedbackQueries.findByIdWithAuthor(id)

            if (!feedback) {
                return { success: false, status: 'FEEDBACK_NOT_FOUND',  message: 'Feedback not found'}
            }

            // feedback visibility logic
            // const isAdmin = await this.isAdmin()
            // if (!isAdmin && feedback.authorId !== user.id) {
            //     return { success: false, message: 'FORBIDDEN' }
            // }

            return {
                success: true,
                data: feedback as FeedbackWithAuthor,
                status: 'GET_SUCCESS',
                message: 'Get feedbacks by id successful'
            }
        } catch (err) {
            console.error('Get feedback error:', err)
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }

    static async list(params: {
        status?: FeedbackStatuses
        search?: string
        page?: number
        limit?: number
    }): Promise<FeedbackResponse<FeedbackList>> {
        try {
            const payload = await AuthService.getCurrentUser()
            const user = payload.data
            if (!payload.success || !user) {
                return { success: false, status: 'UNAUTHORIZED', message: 'Unauthorized user' }
            }

            // const isAdmin = await this.isAdmin()
            const { status, search, page = 1, limit = 20 } = params
            const offset = (page - 1) * limit

            let feedbacks: FeedbackWithAuthor[]
            let total: number

            // if (isAdmin) {
            //     feedbacks = await feedbackQueries.findAll({
            //         status,
            //         search,
            //         limit,
            //         offset
            //     }) as FeedbackWithAuthor[]

            //     total = await feedbackQueries.count({ status, search })
            // } else {
            feedbacks = await feedbackQueries.findByAuthorId(user.id, {
                status,
                search,
                limit,
                offset
            }) as FeedbackWithAuthor[]

            total = await feedbackQueries.count({
                status,
                search,
                authorId: user.id
            })
            // }

            return {
                success: true,
                data: {
                    feedbacks,
                    total
                },
                status: 'GET_SUCCESS',
                message: 'List feedbacks successful'
            }
        } catch (err) {
            console.error('List feedbacks error:', err)
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }

    // // 获取待处理反馈（管理员专用）
    // static async getPendingFeedbacks(): Promise<FeedbackResponse<FeedbackWithAuthor[]>> {
    //     try {
    //         const isAdmin = await this.isAdmin()
    //         if (!isAdmin) {
    //             return { success: false, message: 'FORBIDDEN' }
    //         }

    //         const pendingFeedbacks = await db.query.feedbacks.findMany({
    //             where: inArray(feedbacks.status, ['pending', 'processing', 'forwarded']),
    //             with: {
    //                 author: {
    //                     columns: {
    //                         id: true,
    //                         name: true,
    //                         email: true,
    //                     },
    //                 },
    //             },
    //             orderBy: [asc(feedbacks.createdAt)],
    //         })

    //         return {
    //             success: true,
    //             data: pendingFeedbacks as FeedbackWithAuthor[]
    //         }
    //     } catch (err) {
    //         console.error('Get pending feedbacks error:', err)
    //         return { success: false, message: 'SERVER_ERROR' }
    //     }
    // }

    // // 更新反馈状态（管理员专用）
    // static async updateStatus(
    //     feedbackId: string, 
    //     data: UpdateStatusData
    // ): Promise<FeedbackResponse<DbFeedback>> {
    //     try {
    //         const user = await this.getCurrentUser()
    //         if (!user) {
    //             return { success: false, message: 'UNAUTHORIZED' }
    //         }

    //         const isAdmin = await this.isAdmin()
    //         if (!isAdmin) {
    //             return { success: false, message: 'FORBIDDEN' }
    //         }

    //         const feedback = await db.query.feedbacks.findFirst({
    //             where: eq(feedbacks.id, feedbackId),
    //         })

    //         if (!feedback) {
    //             return { success: false, message: 'FEEDBACK_NOT_FOUND' }
    //         }

    //         const result = await db.transaction(async (tx) => {
    //             // 更新反馈状态
    //             const [updated] = await tx
    //                 .update(feedbacks)
    //                 .set({ 
    //                     status: data.status,
    //                     ...(data.status === 'resolved' ? { resolvedAt: new Date() } : {}),
    //                     updatedAt: new Date(),
    //                 })
    //                 .where(eq(feedbacks.id, feedbackId))
    //                 .returning()

    //             // 记录状态变更
    //             await tx.insert(feedbackStatusLogs).values({
    //                 feedbackId,
    //                 status: data.status,
    //                 changedBy: user.id,
    //                 note: data.note,
    //             })

    //             return updated
    //         })

    //         return {
    //             success: true,
    //             data: result,
    //             message: 'STATUS_UPDATE_SUCCESS'
    //         }
    //     } catch (err) {
    //         console.error('Update status error:', err)
    //         return { success: false, message: 'SERVER_ERROR' }
    //     }
    // }

    // // 管理员回复
    // static async addReply(
    //     feedbackId: string, 
    //     data: AddReplyData
    // ): Promise<FeedbackResponse<DbFeedback>> {
    //     try {
    //         const user = await this.getCurrentUser()
    //         if (!user) {
    //             return { success: false, message: 'UNAUTHORIZED' }
    //         }

    //         const isAdmin = await this.isAdmin()
    //         if (!isAdmin) {
    //             return { success: false, message: 'FORBIDDEN' }
    //         }

    //         const feedback = await db.query.feedbacks.findFirst({
    //             where: eq(feedbacks.id, feedbackId),
    //         })

    //         if (!feedback) {
    //             return { success: false, message: 'FEEDBACK_NOT_FOUND' }
    //         }

    //         const result = await db.transaction(async (tx) => {
    //             // 更新反馈（添加回复并标记为已解决）
    //             const [updated] = await tx
    //                 .update(feedbacks)
    //                 .set({ 
    //                     adminReply: data.reply,
    //                     resolvedAt: new Date(),
    //                     status: 'resolved',
    //                     updatedAt: new Date(),
    //                 })
    //                 .where(eq(feedbacks.id, feedbackId))
    //                 .returning()

    //             // 记录回复操作
    //             await tx.insert(feedbackStatusLogs).values({
    //                 feedbackId,
    //                 status: 'resolved',
    //                 changedBy: user.id,
    //                 note: '管理员回复',
    //             })

    //             return updated
    //         })

    //         return {
    //             success: true,
    //             data: result,
    //             message: 'REPLY_SUCCESS'
    //         }
    //     } catch (err) {
    //         console.error('Add reply error:', err)
    //         return { success: false, message: 'SERVER_ERROR' }
    //     }
    // }

    // // 获取反馈状态变更日志
    // static async getStatusLogs(feedbackId: string): Promise<FeedbackResponse<FeedbackStatusLogWithUser[]>> {
    //     try {
    //         const user = await this.getCurrentUser()
    //         if (!user) {
    //             return { success: false, message: 'UNAUTHORIZED' }
    //         }

    //         const feedback = await db.query.feedbacks.findFirst({
    //             where: eq(feedbacks.id, feedbackId),
    //         })

    //         if (!feedback) {
    //             return { success: false, message: 'FEEDBACK_NOT_FOUND' }
    //         }

    //         // 非管理员只能看自己的反馈日志
    //         const isAdmin = await this.isAdmin()
    //         if (!isAdmin && feedback.authorId !== user.id) {
    //             return { success: false, message: 'FORBIDDEN' }
    //         }

    //         const logs = await db.query.feedbackStatusLogs.findMany({
    //             where: eq(feedbackStatusLogs.feedbackId, feedbackId),
    //             with: {
    //                 changedBy: {
    //                     columns: {
    //                         id: true,
    //                         name: true,
    //                     },
    //                 },
    //             },
    //             orderBy: [desc(feedbackStatusLogs.createdAt)],
    //         })

    //         return {
    //             success: true,
    //             data: logs as FeedbackStatusLogWithUser[]
    //         }
    //     } catch (err) {
    //         console.error('Get status logs error:', err)
    //         return { success: false, message: 'SERVER_ERROR' }
    //     }
    // }

    // // 获取统计信息（管理员专用）
    // static async getStats(): Promise<FeedbackResponse<{
    //     total: number
    //     pending: number
    //     processing: number
    //     resolved: number
    //     invalid: number
    //     avgResponseTime?: number
    // }>> {
    //     try {
    //         const isAdmin = await this.isAdmin()
    //         if (!isAdmin) {
    //             return { success: false, message: 'FORBIDDEN' }
    //         }

    //         const stats = await db
    //             .select({
    //                 status: feedbacks.status,
    //                 count: count(),
    //             })
    //             .from(feedbacks)
    //             .groupBy(feedbacks.status)

    //         const result = {
    //             total: 0,
    //             pending: 0,
    //             processing: 0,
    //             forwarded: 0,
    //             resolved: 0,
    //             invalid: 0,
    //         }

    //         stats.forEach(stat => {
    //             result.total += stat.count
    //             result[stat.status as keyof typeof result] = stat.count
    //         })

    //         return {
    //             success: true,
    //             data: result
    //         }
    //     } catch (err) {
    //         console.error('Get stats error:', err)
    //         return { success: false, message: 'SERVER_ERROR' }
    //     }
    // }
}