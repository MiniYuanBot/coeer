import { and, count, desc, eq, ilike, or, SQL } from 'drizzle-orm'
import { db, type DbExecutor } from '../client'
import { bulletins, NewBulletin, Bulletin } from '../schemas'
import type { BulletinIdInput, ListBulletinsInput, UpdateBulletinInput } from '@shared/contracts'

function buildWhere(data: ListBulletinsInput): SQL | undefined {
    const conditions: SQL[] = []
    if (data.type) conditions.push(eq(bulletins.type, data.type))
    if (data.isPinned !== undefined) conditions.push(eq(bulletins.isPinned, data.isPinned))
    if (data.search) {
        const searchCondition = or(
            ilike(bulletins.title, `%${data.search}%`),
            ilike(bulletins.content, `%${data.search}%`)
        )
        if (searchCondition) conditions.push(searchCondition)
    }
    return conditions.length ? and(...conditions) : undefined
}

export const bulletinQueries = {
    async create(data: NewBulletin, executor: DbExecutor = db): Promise<Bulletin> {
        const [bulletin] = await executor.insert(bulletins).values(data).returning()
        if (!bulletin) throw new Error('Create bulletin failed')
        return bulletin
    },

    async findById(data: BulletinIdInput, executor: DbExecutor = db): Promise<Bulletin | undefined> {
        return executor.query.bulletins.findFirst({ where: eq(bulletins.id, data.id) })
    },

    async list(data: ListBulletinsInput): Promise<Bulletin[]> {
        return db.query.bulletins.findMany({
            where: buildWhere(data),
            orderBy: [desc(bulletins.isPinned), desc(bulletins.createdAt), desc(bulletins.id)],
            limit: data.limit,
            offset: data.offset,
        })
    },

    async update(data: UpdateBulletinInput, executor: DbExecutor = db): Promise<Bulletin> {
        const [bulletin] = await executor.update(bulletins)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(bulletins.id, data.id))
            .returning()
        if (!bulletin) throw new Error('Bulletin not found')
        return bulletin
    },

    async delete(data: BulletinIdInput): Promise<void> {
        await db.delete(bulletins).where(eq(bulletins.id, data.id))
    },

    async count(data: ListBulletinsInput, executor: DbExecutor = db): Promise<number> {
        const [result] = await executor.select({ value: count() }).from(bulletins).where(buildWhere(data))
        return result?.value ?? 0
    },
}
