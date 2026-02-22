import { db } from '../client'
import { feedbacks } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, asc } from 'drizzle-orm'
import type { NewFeedback, Feedback, FeedbackStatus } from '../schemas'

export const feedbackQueries = {
    async create(data: NewFeedback): Promise<Feedback> {
        const [feedback] = await db.insert(feedbacks).values(data).returning()
        return feedback
    },

    async delete(id: string) {
        const [deleted] = await db
            .delete(feedbacks)
            .where(eq(feedbacks.id, id))
            .returning()

        return deleted
    },

    async findById(id: string): Promise<Feedback | undefined> {
        const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.id, id))
        return feedback
    },

    async findByIdWithAuthor(id: string) {
        const result = await db.query.feedbacks.findFirst({
            where: eq(feedbacks.id, id),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
        })
        return result
    },

    async findByAuthorId(authorId: string, params: {
        status?: FeedbackStatus
        search?: string
        limit?: number
        offset?: number
    }) {
        const { status, search, limit = 20, offset = 0 } = params

        const conditions: any[] = [eq(feedbacks.authorId, authorId)]

        if (status) {
            conditions.push(eq(feedbacks.status, status))
        }

        if (search) {
            conditions.push(
                or(
                    ilike(feedbacks.title, `%${search}%`),
                    ilike(feedbacks.content, `%${search}%`)
                )
            )
        }

        const feedbacksList = await db.query.feedbacks.findMany({
            where: and(...conditions),
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: [desc(feedbacks.createdAt)],
            limit,
            offset,
        })

        return feedbacksList
    },

    async findAll(params: {
        status?: FeedbackStatus
        search?: string
        limit?: number
        offset?: number
    }) {
        const { status, search, limit = 20, offset = 0 } = params

        const conditions: any[] = []

        if (status) {
            conditions.push(eq(feedbacks.status, status))
        }

        if (search) {
            conditions.push(
                or(
                    ilike(feedbacks.title, `%${search}%`),
                    ilike(feedbacks.content, `%${search}%`)
                )
            )
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        const feedbacksList = await db.query.feedbacks.findMany({
            where: whereClause,
            with: {
                author: {
                    columns: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: [desc(feedbacks.createdAt)],
            limit,
            offset,
        })

        return feedbacksList
    },

    async count(params: { status?: FeedbackStatus; search?: string; authorId?: string }) {
        const { status, search, authorId } = params

        const conditions: any[] = []

        if (authorId) {
            conditions.push(eq(feedbacks.authorId, authorId))
        }

        if (status) {
            conditions.push(eq(feedbacks.status, status))
        }

        if (search) {
            conditions.push(
                or(
                    ilike(feedbacks.title, `%${search}%`),
                    ilike(feedbacks.content, `%${search}%`)
                )
            )
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined

        const [result] = await db
            .select({ value: count() })
            .from(feedbacks)
            .where(whereClause)

        return result?.value ?? 0
    },

    // // 查询待处理的反馈（管理员用）
    // async findPendingFeedbacks() {
    //     const pendingFeedbacks = await db.query.feedbacks.findMany({
    //         where: inArray(feedbacks.status, ['pending', 'processing', 'forwarded']),
    //         with: {
    //             author: {
    //                 columns: {
    //                     id: true,
    //                     name: true,
    //                     email: true,
    //                 },
    //             },
    //         },
    //         orderBy: [asc(feedbacks.createdAt)],
    //     })

    //     return pendingFeedbacks
    // },

    // // 更新反馈状态
    // async updateStatus(id: string, status: string, resolvedAt?: Date) {
    //     const [updated] = await db
    //         .update(feedbacks)
    //         .set({
    //             status,
    //             ...(resolvedAt ? { resolvedAt } : {}),
    //             updatedAt: new Date(),
    //         })
    //         .where(eq(feedbacks.id, id))
    //         .returning()

    //     return updated
    // },

    // // 添加管理员回复
    // async addReply(id: string, reply: string) {
    //     const [updated] = await db
    //         .update(feedbacks)
    //         .set({
    //             adminReply: reply,
    //             resolvedAt: new Date(),
    //             status: 'resolved',
    //             updatedAt: new Date(),
    //         })
    //         .where(eq(feedbacks.id, id))
    //         .returning()

    //     return updated
    // },

    // // 获取统计信息
    // async getStats() {
    //     const stats = await db
    //         .select({
    //             status: feedbacks.status,
    //             count: count(),
    //         })
    //         .from(feedbacks)
    //         .groupBy(feedbacks.status)

    //     return stats
    // },
}