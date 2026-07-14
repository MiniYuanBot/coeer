import { db } from '../client'
import { feedbacks } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, SQL } from 'drizzle-orm'
import type { NewFeedback, Feedback } from '../schemas'
import {
    CountFeedbacksInput,
    FeedbackIdInput,
    FeedbackWithAuthor,
    ListFeedbacksInput,
    UpdateFeedbackInput
} from '@shared/contracts'
import { FeedbackStatus, FeedbackTargetType } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    authorId?: string
    status?: FeedbackStatus | FeedbackStatus[]
    search?: string
    targetType?: FeedbackTargetType | FeedbackTargetType[]
    isPublic?: boolean
}): SQL | undefined {
    const { status, search, authorId, targetType, isPublic } = params
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

    if (targetType) {
        if (Array.isArray(targetType)) {
            conditions.push(inArray(feedbacks.targetType, targetType))
        } else {
            conditions.push(eq(feedbacks.targetType, targetType))
        }
    }

    if (isPublic !== undefined) {
        conditions.push(eq(feedbacks.isPublic, isPublic))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

function buildVisibleWhereClause(params: CountFeedbacksInput & { viewerId: string }): SQL | undefined {
    const base = buildWhereClause(params)
    const visibility = or(
        eq(feedbacks.authorId, params.viewerId),
        eq(feedbacks.isPublic, true)
    )

    return base ? and(base, visibility) : visibility
}

export const feedbackQueries = {
    // Create a feedback
    async create(data: NewFeedback): Promise<Feedback> {
        const [feedback] = await db.insert(feedbacks).values(data).returning()
        
        if (!feedback) {
            throw new Error('Create failed')
        }

        return feedback
    },

    // Update feedback status
    async update(data: UpdateFeedbackInput): Promise<Feedback> {
        const [feedback] = await db.update(feedbacks)
            .set({
                status: data.status,
                ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
                ...(data.resolvedAt && { resolvedAt: data.resolvedAt }),
                updatedAt: new Date(),
            })
            .where(eq(feedbacks.id, data.id))
            .returning()

        if (!feedback) {
            throw new Error('Update failed')
        }

        return feedback
    },

    // Delete a feedback
    async delete(data: FeedbackIdInput): Promise<Feedback> {
        const [feedback] = await db
        .delete(feedbacks)
        .where(eq(feedbacks.id, data.id))
        .returning()

        if (!feedback) {
            throw new Error('Delete failed')
        }

        return feedback
    },

    // Find a feedback by its ID
    async findById(data: FeedbackIdInput): Promise<Feedback | undefined> {
        const [feedback] = await db.select().from(feedbacks).where(eq(feedbacks.id, data.id))
        return feedback
    },

    // Find a feedback with author info by its ID
    async findByIdWithAuthor(data: FeedbackIdInput): Promise<FeedbackWithAuthor | undefined> {
        return db.query.feedbacks.findFirst({
            where: eq(feedbacks.id, data.id),
            with: {
                author: {
                    columns: { id: true, name: true, email: true },
                },
            },
        })
    },

    // Find all feedbacks by author ID with optional filters
    async findByAuthorId(data: ListFeedbacksInput): Promise<FeedbackWithAuthor[]> {
        const { limit, offset } = data

        return db.query.feedbacks.findMany({
            where: buildWhereClause({ ...data, authorId: data.authorId }),
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

    // Find feedbacks visible to a regular user: own submissions or approved public items.
    async findVisibleToUser(data: ListFeedbacksInput & { viewerId: string }): Promise<FeedbackWithAuthor[]> {
        const { limit, offset } = data

        return db.query.feedbacks.findMany({
            where: buildVisibleWhereClause(data),
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
    async findAll(data: ListFeedbacksInput): Promise<FeedbackWithAuthor[]> {
        const { limit, offset } = data

        return db.query.feedbacks.findMany({
            where: buildWhereClause(data),
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
    async count(data: CountFeedbacksInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(feedbacks)
            .where(buildWhereClause(data))

        return result?.value ?? 0
    },

    async countVisibleToUser(data: CountFeedbacksInput & { viewerId: string }): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(feedbacks)
            .where(buildVisibleWhereClause(data))

        return result?.value ?? 0
    },

    // Get feedback status
    // async getStats(): Promise<{status: FeedbackStatus, count: number}[]> {
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
