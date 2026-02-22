import { db } from '../client'
import { feedbacks } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, asc, SQL } from 'drizzle-orm'
import type { NewFeedback, Feedback } from '../schemas'
import { FeedbackWithAuthor } from '@shared/contracts'
import { FeedbackStatuses, FeedbackTargetTypes } from '@shared/constants'

// private query condition builder
function buildWhereClause(params: {
    status?: FeedbackStatuses
    search?: string
    authorId?: string
}): SQL | undefined {
    const { status, search, authorId } = params
    const conditions: SQL[] = []

    if (authorId) {
        conditions.push(eq(feedbacks.authorId, authorId))
    }

    if (status) {
        conditions.push(eq(feedbacks.status, status))
    }

    if (search) {
        const searchCondition = or(
            ilike(feedbacks.title, `%${search}%`),
            ilike(feedbacks.content, `%${search}%`)
        )
        if (searchCondition) {
            conditions.push(searchCondition)
        }
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

export const feedbackQueries = {
    async create(data: NewFeedback): Promise<Feedback> {
        const [feedback] = await db.insert(feedbacks).values(data).returning()
        return feedback
    },

    async delete(id: string): Promise<Feedback> {
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

    async findByIdWithAuthor(id: string): Promise<FeedbackWithAuthor | undefined> {
        return db.query.feedbacks.findFirst({
            where: eq(feedbacks.id, id),
            with: {
                author: {
                    columns: { id: true, name: true, email: true },
                },
            },
        })
    },

    async findByAuthorId(
        authorId: string,
        params: {
            status?: FeedbackStatuses
            search?: string
            limit?: number
            offset?: number
        }
    ): Promise<FeedbackWithAuthor[]> {
        const { search, status, limit = 20, offset = 0 } = params

        return db.query.feedbacks.findMany({
            where: buildWhereClause({ authorId, status, search }),
            with: {
                author: {
                    columns: { id: true, name: true, email: true },
                },
            },
            orderBy: [desc(feedbacks.createdAt)],
            limit,
            offset,
        })
    },

    async findAll(params: {
        status?: FeedbackStatuses
        search?: string
        limit?: number
        offset?: number
    }): Promise<FeedbackWithAuthor[]> {
        const { status, search, limit = 20, offset = 0 } = params

        return db.query.feedbacks.findMany({
            where: buildWhereClause({ status, search }),
            with: {
                author: {
                    columns: { id: true, name: true, email: true },
                },
            },
            orderBy: [desc(feedbacks.createdAt)],
            limit,
            offset,
        })
    },

    async count(params: {
        status?: FeedbackStatuses
        search?: string
        authorId?: string
    }): Promise<number> {
        const whereClause = buildWhereClause(params)

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