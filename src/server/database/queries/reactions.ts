import { and, count, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { NewReaction, Reaction, reactions, users } from '../schemas'
import type { ListMyReactionsInput, ListReactionsInput, ToggleReactionInput } from '@shared/contracts'

export const reactionQueries = {
    async toggle(userId: string, data: ToggleReactionInput) {
        return db.transaction(async (tx) => {
            await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update')
            const where = and(eq(reactions.targetType, data.targetType), eq(reactions.targetId, data.targetId))
            const [existing] = await tx.select().from(reactions).where(and(where, eq(reactions.userId, userId)))
            if (existing) await tx.delete(reactions).where(eq(reactions.id, existing.id))
            else await tx.insert(reactions).values({ userId, ...data })
            const [total] = await tx.select({ value: count() }).from(reactions).where(where)
            return { reacted: !existing, count: total.value }
        })
    },

    async summarizePosts(ids: string[], userId?: string) {
        if (!ids.length) return new Map<string, { reactionCount: number; hasReacted: boolean }>()
        const rows = await db.select({ targetId: reactions.targetId, reactionCount: count(),
            hasReacted: userId ? sql<boolean>`bool_or(${reactions.userId} = ${userId})` : sql<boolean>`false`,
        }).from(reactions).where(and(eq(reactions.targetType, 'group_post'), inArray(reactions.targetId, ids))).groupBy(reactions.targetId)
        return new Map(rows.map((row) => [row.targetId, { reactionCount: row.reactionCount, hasReacted: row.hasReacted }]))
    },
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

