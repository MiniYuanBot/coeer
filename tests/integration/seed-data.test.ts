import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { eq, getTableName, is, sql } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import bcrypt from 'bcryptjs'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))
import { db, client, initializeDatabase } from '../support/database'
import { seedAll } from '~/database/seed'
import * as schema from '~/database/schemas'

beforeAll(initializeDatabase)
afterAll(() => client.close())

it('seeds consistent linked data and reruns without duplicates or overwriting credentials', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
        await seedAll({ clean: false })
        const counts = async () => {
            const values: Record<string, number> = {}
            for (const table of Object.values(schema)) if (is(table, PgTable)) {
                const result = await db.select({ value: sql<number>`count(*)::int` }).from(table)
                values[getTableName(table)] = result[0].value
            }
            return values
        }
        const initial = await counts()
        const [user] = await db.select().from(schema.users).where(eq(schema.users.email, '0000000001@stu.pku.edu.cn'))
        const passwordHash = await bcrypt.hash('user-changed-password', 4)
        await db.update(schema.users).set({ passwordHash, name: '保留昵称' }).where(eq(schema.users.id, user.id))
        const [calendar] = await db.select().from(schema.groupPosts).where(eq(schema.groupPosts.title, '校园活动日历上线'))
        const [sharing] = await db.select().from(schema.activities).where(eq(schema.activities.title, '编程学习小组项目分享会'))
        await db.update(schema.groupPosts).set({ title: '九月校园活动日历上线' }).where(eq(schema.groupPosts.id, calendar.id))
        await db.update(schema.activities).set({ title: '辩论社表演赛观摩' }).where(eq(schema.activities.id, sharing.id))
        await seedAll({ clean: false })
        expect(await counts()).toEqual(initial)
        expect((await db.select().from(schema.groupPosts).where(eq(schema.groupPosts.id, calendar.id)))[0].title).toBe('校园活动日历上线')
        expect((await db.select().from(schema.activities).where(eq(schema.activities.id, sharing.id)))[0].title).toBe('编程学习小组项目分享会')
        expect((await db.select().from(schema.users).where(eq(schema.users.id, user.id)))[0]).toMatchObject({ passwordHash, name: '保留昵称' })
        const feedbacks = await db.select().from(schema.feedbacks)
        for (const feedback of feedbacks) {
            expect(feedback.createdAt.getTime()).toBeLessThanOrEqual(feedback.updatedAt.getTime())
            if (feedback.resolvedAt) expect(feedback.resolvedAt.getTime()).toBeGreaterThanOrEqual(feedback.createdAt.getTime())
            const logs = await db.select().from(schema.feedbackStatusLogs).where(eq(schema.feedbackStatusLogs.feedbackId, feedback.id))
            expect(logs.length).toBeGreaterThan(0)
            for (const entry of logs) expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(feedback.createdAt.getTime())
        }
        const users = await db.select().from(schema.users)
        const groups = await db.select().from(schema.groups)
        const activities = await db.select().from(schema.activities)
        expect(new Set(activities.map((item) => item.status))).toEqual(new Set(['upcoming', 'ongoing', 'completed', 'cancelled']))
        for (const activity of activities) {
            expect(activity.endTime.getTime()).toBeGreaterThan(activity.startTime.getTime())
            if (activity.type === 'official') expect(users.find((user) => user.id === activity.organizerId)?.role).toBe('admin')
            if (activity.organizerType === 'group') expect(groups.some((group) => group.id === activity.organizerId)).toBe(true)
            const participants = await db.select().from(schema.activityParticipants).where(eq(schema.activityParticipants.activityId, activity.id))
            if (activity.maxParticipants) expect(participants.length).toBeLessThanOrEqual(activity.maxParticipants)
            if (activity.status === 'cancelled') expect(participants).toHaveLength(0)
        }
        const posts = await db.select().from(schema.groupPosts)
        for (const bulletin of await db.select().from(schema.bulletins)) if (bulletin.sourceType === 'group_post') expect(posts.some((post) => post.id === bulletin.sourceId)).toBe(true)
        for (const item of [...await db.select().from(schema.cards), ...await db.select().from(schema.redeemItems)]) {
            expect(item.imageUrl).toMatch(/^\/demo\//)
            expect(existsSync(resolve('public', item.imageUrl!.slice(1)))).toBe(true)
        }
        expect(await db.select().from(schema.replies)).toHaveLength(0)
        expect((await db.select().from(schema.notifications)).length).toBeGreaterThan(0)
    } finally { log.mockRestore() }
}, 30000)
