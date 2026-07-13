import { and, count, desc, eq, SQL } from 'drizzle-orm'
import { db } from '../client'
import { bulletins, NewBulletin, Bulletin } from '../schemas'
import type { BulletinIdInput, ListBulletinsInput, UpdateBulletinInput } from '@shared/contracts'

function buildWhere(data: ListBulletinsInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.type) conditions.push(eq(bulletins.type, data.type))
    if (data.isPinned !== undefined) conditions.push(eq(bulletins.isPinned, data.isPinned))
    return conditions.length ? and(...conditions) : undefined
}

export const bulletinQueries = {
    async create(data: NewBulletin): Promise<Bulletin> {
        const [bulletin] = await db.insert(bulletins).values(data).returning()
        if (!bulletin) throw new Error('Create bulletin failed')
        return bulletin
    },

    async findById(data: BulletinIdInput): Promise<Bulletin | undefined> {
        return db.query.bulletins.findFirst({ where: eq(bulletins.id, data.id) })
    },

    async list(data: ListBulletinsInput): Promise<Bulletin[]> {
        return db.query.bulletins.findMany({
            where: buildWhere(data),
            orderBy: [desc(bulletins.isPinned), desc(bulletins.createdAt)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async update(data: UpdateBulletinInput): Promise<Bulletin> {
        const [bulletin] = await db.update(bulletins)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(bulletins.id, data.id))
            .returning()
        if (!bulletin) throw new Error('Bulletin not found')
        return bulletin
    },

    async delete(data: BulletinIdInput): Promise<void> {
        await db.delete(bulletins).where(eq(bulletins.id, data.id))
    },

    async count(data: ListBulletinsInput): Promise<number> {
        const [result] = await db.select({ value: count() }).from(bulletins).where(buildWhere(data))
        return result?.value ?? 0
    },
}

