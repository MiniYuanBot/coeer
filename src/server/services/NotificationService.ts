import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db, type DbExecutor } from '../database/client'
import { notifications } from '../database/schemas'
import { AuthService } from './AuthService'

export class NotificationService {
    /** Call within the business transaction so a failed action never sends a notification. */
    static async create(data: typeof notifications.$inferInsert, executor: DbExecutor = db) {
        await executor.insert(notifications).values(data)
    }

    private static async userId() {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) throw new Error('请先登录')
        return current.data.id
    }

    static async list(data: { limit: number; offset: number; unreadOnly: boolean }) {
        const userId = await this.userId()
        const own = eq(notifications.userId, userId)
        const where = data.unreadOnly ? and(own, isNull(notifications.readAt)) : own
        const [items, [total], [unread]] = await Promise.all([
            db.select().from(notifications).where(where).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(data.limit).offset(data.offset),
            db.select({ value: count() }).from(notifications).where(where),
            db.select({ value: count() }).from(notifications).where(and(own, isNull(notifications.readAt))),
        ])
        return { items, total: total.value, unread: unread.value }
    }

    static async unreadCount() {
        const userId = await this.userId()
        const [result] = await db.select({ value: count() }).from(notifications)
            .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        return result.value
    }

    static async markRead(id?: string) {
        const userId = await this.userId()
        await db.update(notifications).set({ readAt: new Date() }).where(and(
            eq(notifications.userId, userId), isNull(notifications.readAt), id ? eq(notifications.id, id) : undefined,
        ))
    }
}
