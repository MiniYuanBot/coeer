import { db } from '../client'
import { feedbacks } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, asc, SQL } from 'drizzle-orm'
import type { NewFeedback, Feedback } from '../schemas'
import { FeedbackWithAuthor } from '@shared/contracts'
import { FeedbackStatus } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    authorId?: string
    status?: FeedbackStatus | FeedbackStatus[]
    search?: string
}): SQL | undefined {
    const { status, search, authorId } = params
    const conditions: SQL[] = []

    if (authorId) {
        conditions.push(eq(feedbacks.authorId, authorId))
    }

    if (status) {
        if (Array.isArray(status)) {
            conditions.push(inArray(feedbacks.status, status))
        } else {
            conditions.push(eq(feedbacks.status, status))
        }
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
    // Create a feedback
    async create(data: NewFeedback): Promise<Feedback> {
        const [feedback] = await db.insert(feedbacks).values(data).returning()
        return feedback
    },

    // Delete a feedback
    async delete(id: string): Promise<void> {
        await db.delete(feedbacks).where(eq(feedbacks.id, id))
    },

    // Find a feedback by its ID
    async findById(id: string): Promise<Feedback | undefined> {
        const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.id, id))
        return feedback
    },

    // Find a feedback with author info by its ID
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

    // Find all feedbacks by author ID with optional filters
    async findByAuthorId(
        authorId: string,
        params: {
            status?: FeedbackStatus
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

    // Find all feedbacks with optional filters
    async findAll(params: {
        status?: FeedbackStatus
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

    // Count all feedbacks with optional filters
    async count(params: {
        status?: FeedbackStatus
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

    // Update feedback status
    async updateStatus(id: string, status: FeedbackStatus, resolvedAt?: Date): Promise<void> {
        await db.update(feedbacks)
            .set({
                status,
                ...(resolvedAt ? { resolvedAt } : {}),
                updatedAt: new Date(),
            })
            .where(eq(feedbacks.id, id))
    },

    // Get feedback status
    // async getStats(): Promise<FeedbackStatus[]> {
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