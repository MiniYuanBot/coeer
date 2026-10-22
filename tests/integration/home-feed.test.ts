import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData> }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { activities, bulletins, groupMembers, groupPosts, groups, users } from '~/database/schemas'
import { GroupPostService } from '~/services/GroupPostService'
import { BulletinService } from '~/services/BulletinService'
import { ActivityService } from '~/services/ActivityService'

const admin = '11111111-1111-4111-8111-111111111111'
const student = '22222222-2222-4222-8222-222222222222'
const pagination = { limit: 5, offset: 0 }
function signIn(id = admin) {
    session.data = { id, passwordVersion: createHash('sha256').update('review-hash').digest('hex') }
}
async function group(slug: string, options: { isPublic?: boolean; status?: 'approved' | 'pending' } = {}) {
    const [item] = await db.insert(groups).values({ name: slug, slug, category: GROUP_CATEGORY_ARRAY[0], status: 'approved', ...options }).returning()
    await db.insert(groupMembers).values({ groupId: item.id, userId: admin, role: 'admin', status: 'approved' })
    return item
}
beforeAll(initializeDatabase)
beforeEach(async () => {
    await resetDatabase()
    session.data = {}
    await db.insert(users).values([
        { id: admin, email: 'admin@example.test', role: 'admin', passwordHash: 'review-hash' },
        { id: student, email: 'student@example.test', role: 'student', passwordHash: 'review-hash' },
    ])
})
afterAll(() => client.close())

describe('homepage public updates', () => {
    it('takes the latest five posts across every approved public group, regardless of pins or viewer membership', async () => {
        const publicGroups = await Promise.all(Array.from({ length: 12 }, (_, index) => group(`public-${index}`)))
        const privateGroup = await group('private', { isPublic: false })
        const pendingGroup = await group('pending', { status: 'pending' })
        await db.insert(groupPosts).values([
            ...publicGroups.map((item, index) => ({ groupId: item.id, title: `public-${index}`, content: '公开正文', createdAt: new Date(2026, 0, index + 1), isPinned: index === 0 })),
            ...[privateGroup, pendingGroup].map((item) => ({ groupId: item.id, title: 'hidden', content: '不能公开的内容', createdAt: new Date(2027, 0, 1) })),
        ])
        for (const viewer of [null, student, admin]) {
            if (viewer) signIn(viewer)
            else session.data = {}
            const result = await GroupPostService.listRecentPublic()
            expect(result.success).toBe(true)
            expect(result.data?.map((post) => post.title)).toEqual(['public-11', 'public-10', 'public-9', 'public-8', 'public-7'])
            expect(result.data?.every((post) => post.group.slug.startsWith('public-'))).toBe(true)
            expect(result.data?.every((post) => !('replies' in post))).toBe(true)
        }
    })

    it('orders public activity announcements by publication time rather than event start time', async () => {
        const publicGroup = await group('public')
        const privateGroup = await group('private', { isPublic: false })
        const pendingGroup = await group('pending', { status: 'pending' })
        await db.insert(activities).values([
            ...Array.from({ length: 6 }, (_, index) => ({
                title: `activity-${index}`, description: '活动内容', type: 'official' as const,
                organizerType: 'user' as const, organizerId: admin, createdAt: new Date(2026, 0, index + 1),
                startTime: new Date(2028, 0, 20 - index), endTime: new Date(2028, 0, 21 - index),
            })),
            ...[publicGroup, privateGroup, pendingGroup].map((item) => ({
                title: item.slug, description: '群组活动', type: 'group' as const,
                organizerType: 'group' as const, organizerId: item.id, createdAt: new Date(2027, 0, 1),
                startTime: new Date(2028, 0, 1), endTime: new Date(2028, 0, 2),
            })),
        ])
        const result = await ActivityService.list({ ...pagination, sort: 'latest', publicOnly: true })
        expect(result.data?.total).toBe(7)
        expect(result.data?.items?.map((activity) => activity.title)).toEqual(['public', 'activity-5', 'activity-4', 'activity-3', 'activity-2'])
    })

    it('shows pinned official bulletins before recent ones and excludes other bulletin types', async () => {
        await db.insert(bulletins).values([
            ...Array.from({ length: 6 }, (_, index) => ({ title: `official-${index}`, content: '正文', type: 'official' as const, createdAt: new Date(2026, 0, index + 1), isPinned: index === 0 })),
            { title: 'group-announcement', content: '群组公告', type: 'group_announcement', isPinned: true },
        ])
        const result = await BulletinService.list({ ...pagination, type: 'official' })
        expect(result.data?.items?.map((item) => item.title)).toEqual(['official-0', 'official-5', 'official-4', 'official-3', 'official-2'])
    })
})

describe('five-pin limits', () => {
    it('caps concurrent bulletin creation and pin edits together, while allowing edits and unpinning at the limit', async () => {
        signIn()
        const pinned = await db.insert(bulletins).values(Array.from({ length: 4 }, (_, index) => ({ title: `pinned-${index}`, content: '正文', type: 'official' as const, isPinned: true }))).returning()
        const [candidate] = await db.insert(bulletins).values({ title: 'candidate', content: '正文', type: 'official' }).returning()
        const results = await Promise.all([
            BulletinService.update({ id: candidate.id, isPinned: true }),
            ...Array.from({ length: 3 }, (_, index) => BulletinService.create({ title: `new-${index}`, content: '正文', type: 'official', isPinned: true })),
        ])
        expect(results.filter((result) => result.success)).toHaveLength(1)
        expect(results.filter((result) => result.state.code === 'PIN_LIMIT_REACHED')).toHaveLength(3)
        expect(await db.select().from(bulletins).where(eq(bulletins.isPinned, true))).toHaveLength(5)
        expect((await BulletinService.update({ id: pinned[0].id, title: 'edited', isPinned: true })).success).toBe(true)
        expect((await BulletinService.create({ title: 'unpinned', content: '正文', type: 'official', isPinned: false })).success).toBe(true)
        expect((await BulletinService.update({ id: pinned[0].id, isPinned: false })).success).toBe(true)
        expect((await BulletinService.create({ title: 'replacement', content: '正文', type: 'official', isPinned: true })).success).toBe(true)
        expect(await db.select().from(bulletins).where(eq(bulletins.isPinned, true))).toHaveLength(5)
    })

    it('caps each group independently under concurrent pin requests and keeps the group-admin permission check', async () => {
        signIn()
        const first = await group('first')
        const second = await group('second')
        const posts = await db.insert(groupPosts).values(Array.from({ length: 8 }, (_, index) => ({ groupId: first.id, title: `post-${index}`, content: '正文', isPinned: index < 3 }))).returning()
        const results = await Promise.all(posts.slice(3).map((post) => GroupPostService.togglePin({ id: post.id, isPinned: true })))
        expect(results.filter((result) => result.success)).toHaveLength(2)
        expect(results.filter((result) => result.state.code === 'PIN_LIMIT_REACHED')).toHaveLength(3)
        expect((await db.select().from(groupPosts).where(eq(groupPosts.groupId, first.id))).filter((post) => post.isPinned)).toHaveLength(5)
        expect((await GroupPostService.togglePin({ id: posts[0].id, isPinned: true })).success).toBe(true)
        const [other] = await db.insert(groupPosts).values({ groupId: second.id, title: 'other', content: '正文' }).returning()
        expect((await GroupPostService.togglePin({ id: other.id, isPinned: true })).success).toBe(true)
        expect((await GroupPostService.togglePin({ id: posts[0].id, isPinned: false })).success).toBe(true)
        signIn(student)
        expect((await GroupPostService.togglePin({ id: posts[0].id, isPinned: true })).state.code).toBe('FORBIDDEN')
        signIn()
        expect((await GroupPostService.togglePin({ id: posts[0].id, isPinned: true })).success).toBe(true)
    })
})
