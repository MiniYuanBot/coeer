import { and, count, desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { NewReply, replies, Reply } from '../schemas'
import type {
    ListChildRepliesInput,
    ListRepliesByAuthorInput,
    ListRepliesByTargetInput,
    ReplyIdInput,
    UpdateReplyInput,
} from '@shared/contracts'

export const replyQueries = {
    async create(data: NewReply): Promise<Reply> {
        const [reply] = await db.insert(replies).values(data).returning()
        if (!reply) throw new Error('Create reply failed')
        return reply
    },

    async findById(data: ReplyIdInput) {
        return db.query.replies.findFirst({
            where: eq(replies.id, data.id),
            with: { author: { columns: { id: true, name: true } } },
        })
    },

    async listByTarget(data: ListRepliesByTargetInput) {
        return db.query.replies.findMany({
            where: and(eq(replies.targetType, data.targetType), eq(replies.targetId, data.targetId)),
            with: { author: { columns: { id: true, name: true } } },
            orderBy: [desc(replies.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async listChildren(data: ListChildRepliesInput) {
        return db.query.replies.findMany({
            where: eq(replies.parentId, data.parentId),
            with: { author: { columns: { id: true, name: true } } },
            orderBy: [desc(replies.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async listByAuthor(data: ListRepliesByAuthorInput): Promise<Reply[]> {
        return db.query.replies.findMany({
            where: eq(replies.userId, data.authorId),
            orderBy: [desc(replies.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async update(data: UpdateReplyInput): Promise<Reply> {
        const [reply] = await db.update(replies)
            .set({ content: data.content, updatedAt: new Date() })
            .where(eq(replies.id, data.id))
            .returning()
        if (!reply) throw new Error('Reply not found')
        return reply
    },

    async delete(data: ReplyIdInput): Promise<void> {
        await db.delete(replies).where(eq(replies.id, data.id))
    },

    async countByTarget(data: ListRepliesByTargetInput): Promise<number> {
        const [result] = await db.select({ value: count() }).from(replies)
            .where(and(eq(replies.targetType, data.targetType), eq(replies.targetId, data.targetId)))
        return result?.value ?? 0
    },
}

