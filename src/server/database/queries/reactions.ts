import { and, count, eq } from 'drizzle-orm'
import { db } from '../client'
import { NewReaction, Reaction, reactions } from '../schemas'
import type { ListMyReactionsInput, ListReactionsInput, ToggleReactionInput } from '@shared/contracts'

export const reactionQueries = {
    async create(data: NewReaction): Promise<Reaction> {
        const [reaction] = await db.insert(reactions).values(data).returning()
        if (!reaction) throw new Error('Create reaction failed')
        return reaction
    },

    async findByUserAndTarget(userId: string, data: ToggleReactionInput): Promise<Reaction | undefined> {
        return db.query.reactions.findFirst({
            where: and(
                eq(reactions.userId, userId),
                eq(reactions.targetType, data.targetType),
                eq(reactions.targetId, data.targetId),
            ),
        })
    },

    async deleteById(id: string): Promise<void> {
        await db.delete(reactions).where(eq(reactions.id, id))
    },

    async listByTarget(data: ListReactionsInput) {
        return db.query.reactions.findMany({
            where: and(eq(reactions.targetType, data.targetType), eq(reactions.targetId, data.targetId)),
            with: { user: { columns: { id: true, name: true } } },
            limit: data.limit,
            offset: data.offset,
        })
    },

    async listByUser(userId: string, data: ListMyReactionsInput): Promise<Reaction[]> {
        return db.query.reactions.findMany({
            where: data.targetType
                ? and(eq(reactions.userId, userId), eq(reactions.targetType, data.targetType))
                : eq(reactions.userId, userId),
            limit: data.limit,
            offset: data.offset,
        })
    },

    async countByTarget(data: ToggleReactionInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(reactions)
            .where(and(eq(reactions.targetType, data.targetType), eq(reactions.targetId, data.targetId)))
        return result?.value ?? 0
    },
}

