import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData> }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { groupMembers, groupPosts, groups, users } from '~/database/schemas'
import { GroupService } from '~/services/GroupService'
import { GroupPostService } from '~/services/GroupPostService'

const admin = '11111111-1111-4111-8111-111111111111'
const student = '22222222-2222-4222-8222-222222222222'
const page = { limit: 10, offset: 0 }
function signIn(id = student) {
    session.data = { id, passwordVersion: createHash('sha256').update('review-hash').digest('hex') }
}
async function fixture() {
    const [publicGroup, privateGroup, pendingGroup] = await db.insert(groups).values([
        { name: '公开读书会', description: '阅读交流', slug: 'public-reading', isPublic: true, status: 'approved' as const },
        { name: '私密读书会', description: '内部阅读交流', slug: 'secret-reading', isPublic: false, status: 'approved' as const },
        { name: '待审核读书会', slug: 'pending-reading', isPublic: false, status: 'pending' as const },
    ].map(item => ({ ...item, category: GROUP_CATEGORY_ARRAY[0] }))).returning()
    return { publicGroup, privateGroup, pendingGroup }
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

describe('group discovery privacy', () => {
    it('partitions reviewed groups and the review queue before pagination and counting', async () => {
        const { publicGroup, privateGroup, pendingGroup } = await fixture()
        const [rejectedGroup] = await db.insert(groups).values({ name: '驳回群组', slug: 'rejected', category: GROUP_CATEGORY_ARRAY[0], status: 'rejected' }).returning()
        signIn(admin)
        const reviewed = await GroupService.listAdminGroups({ ...page, reviewScope: 'reviewed' })
        expect(reviewed.data?.total).toBe(3)
        expect(reviewed.data?.items?.map(item => item.id).sort()).toEqual([publicGroup.id, privateGroup.id, rejectedGroup.id].sort())
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'reviewed', limit: 1, offset: 3 })).data)
            .toMatchObject({ total: 3, items: [] })
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'reviewed', status: 'rejected' })).data)
            .toMatchObject({ total: 1, items: [{ id: rejectedGroup.id }] })
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'reviewed', status: 'pending' })).data)
            .toMatchObject({ total: 0, items: [] })
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'pending' })).data)
            .toMatchObject({ total: 1, items: [{ id: pendingGroup.id }] })
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'pending', isPublic: true })).data)
            .toMatchObject({ total: 0, items: [] })
        expect((await GroupService.updateGroupStatus({ id: pendingGroup.id, status: 'approved', reviewNote: '审核通过' })).success).toBe(true)
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'pending' })).data).toMatchObject({ total: 0, items: [] })
        expect((await GroupService.listAdminGroups({ ...page, reviewScope: 'reviewed' })).data?.total).toBe(4)
        expect((await GroupService.listAllGroups({ ...page, reviewScope: 'reviewed' })).data)
            .toMatchObject({ total: 1, items: [{ id: publicGroup.id }] })
    })
    it('combines moderation filters before pagination without allowing private discovery', async () => {
        const { privateGroup } = await fixture()
        signIn(admin)
        const filters = { isPublic: false, category: GROUP_CATEGORY_ARRAY[0], status: 'approved' as const, search: '读书会', limit: 1, offset: 0 }
        expect((await GroupService.listAdminGroups(filters)).data)
            .toMatchObject({ total: 1, items: [{ id: privateGroup.id }] })
        expect((await GroupService.listAdminGroups({ ...filters, offset: 1 })).data)
            .toMatchObject({ total: 1, items: [] })
        expect((await GroupService.listAdminGroups({ ...filters, category: GROUP_CATEGORY_ARRAY[1] })).data)
            .toMatchObject({ total: 0, items: [] })
        expect((await GroupService.listAllGroups(filters)).data).toMatchObject({ total: 0, items: [] })
        expect((await GroupService.listAllGroups({ ...filters, search: undefined })).data).toMatchObject({ total: 0, items: [] })
    })
    it('excludes private and unapproved groups before listing and counting, even for members and platform admins', async () => {
        const { publicGroup, privateGroup } = await fixture()
        await db.insert(groupMembers).values({ groupId: privateGroup.id, userId: student, role: 'admin', status: 'approved' })
        for (const viewer of [null, student, admin]) {
            if (viewer) signIn(viewer)
            else session.data = {}
            for (const search of [undefined, '读书会', '阅读', '私密读书会', '内部阅读交流', 'secret', 'SECRET-READING', 'secret%', '%', '_']) {
                const result = await GroupService.listAllGroups({ ...page, search })
                const expected = [undefined, '读书会', '阅读'].includes(search) ? [publicGroup.id] : []
                expect(result.success).toBe(true)
                expect(result.data?.items?.map(item => item.id)).toEqual(expected)
                expect(result.data?.total).toBe(expected.length)
            }
            const next = await GroupService.listAllGroups({ limit: 1, offset: 1 })
            expect(next.data).toMatchObject({ total: 1, items: [] })
        }
    })

    it('matches slugs exactly for both public and private groups while retaining public name and description search', async () => {
        const { publicGroup, privateGroup } = await fixture()
        for (const group of [publicGroup, privateGroup]) {
            const result = await GroupService.listAllGroups({ ...page, search: group.slug })
            expect(result.data).toMatchObject({ total: 1, items: [{ id: group.id }] })
            for (const search of [group.slug.slice(0, -1), group.slug.toUpperCase(), `${group.slug}%`, `${group.slug}_`]) {
                expect((await GroupService.listAllGroups({ ...page, search })).data).toMatchObject({ total: 0, items: [] })
            }
        }
        expect((await GroupService.listAllGroups({ ...page, search: '阅读' })).data).toMatchObject({ total: 1, items: [{ id: publicGroup.id }] })
        expect((await GroupService.listAllGroups({ ...page, search: privateGroup.slug, category: GROUP_CATEGORY_ARRAY[1] })).data)
            .toMatchObject({ total: 0, items: [] })
    })

    it('does not expose unapproved groups through status filters or exact slugs', async () => {
        const { pendingGroup } = await fixture()
        for (const status of ['pending', 'rejected'] as const) {
            const result = await GroupService.listAllGroups({ ...page, status, search: pendingGroup.slug })
            expect(result.data).toMatchObject({ total: 0, items: [] })
        }
        expect((await GroupService.listAllGroups({ ...page, search: pendingGroup.slug })).data).toMatchObject({ total: 0, items: [] })
    })

    it('keeps moderation available only to authenticated platform admins through its separate entry point', async () => {
        const { privateGroup, pendingGroup } = await fixture()
        expect((await GroupService.listAdminGroups(page)).state.code).toBe('UNAUTHORIZED')
        signIn()
        // Being a group admin does not grant platform moderation access.
        await db.insert(groupMembers).values({ groupId: privateGroup.id, userId: student, role: 'admin', status: 'approved' })
        expect((await GroupService.listAdminGroups(page)).state.code).toBe('FORBIDDEN')
        signIn(admin)
        expect((await GroupService.listAdminGroups(page)).data?.total).toBe(3)
        expect((await GroupService.listAdminGroups({ ...page, status: 'pending' })).data)
            .toMatchObject({ total: 1, items: [{ id: pendingGroup.id }] })
        expect((await GroupService.listAdminGroups({ ...page, search: privateGroup.name })).data)
            .toMatchObject({ total: 1, items: [{ id: privateGroup.id }] })
        expect((await GroupService.listAllGroups({ ...page, search: privateGroup.name })).data)
            .toMatchObject({ total: 0, items: [] })
    })

    it('allows applying via an exact private slug without granting access to its posts', async () => {
        const { privateGroup } = await fixture()
        const [post] = await db.insert(groupPosts).values({ groupId: privateGroup.id, title: '内部公告', content: '私密内容', type: 'announcement' }).returning()
        signIn()
        expect((await GroupService.listAllGroups({ ...page, search: privateGroup.slug })).data?.items?.[0].id).toBe(privateGroup.id)
        expect((await GroupService.getBySlug({ slug: privateGroup.slug })).success).toBe(true)
        expect((await GroupService.joinGroup({ groupId: privateGroup.id })).success).toBe(true)
        expect((await db.select().from(groupMembers)).map(member => member.status)).toEqual(['pending'])
        expect((await GroupPostService.getById({ id: post.id })).success).toBe(false)
        expect((await GroupPostService.listByGroup({ ...page, groupId: privateGroup.id })).success).toBe(false)
    })

    it('removes a group and its announcements and discussions from discovery immediately after it becomes private', async () => {
        const { publicGroup } = await fixture()
        await db.insert(groupPosts).values(['announcement', 'discussion'].map(type => ({
            groupId: publicGroup.id, authorId: student, title: type, content: '群组内容', type: type as 'announcement' | 'discussion',
        })))
        expect((await GroupPostService.listRecentPublic()).data).toHaveLength(2)
        expect((await GroupPostService.listByAuthor({ ...page, authorId: student })).data?.total).toBe(2)
        await db.update(groups).set({ isPublic: false }).where(eq(groups.id, publicGroup.id))
        for (const viewer of [null, student, admin]) {
            if (viewer) signIn(viewer)
            else session.data = {}
            expect((await GroupService.listAllGroups(page)).data).toMatchObject({ total: 0, items: [] })
            expect((await GroupPostService.listRecentPublic()).data).toEqual([])
            expect((await GroupPostService.listByAuthor({ ...page, authorId: student })).data).toMatchObject({ total: 0, items: [] })
        }
    })

    it('filters private and unapproved author posts before pagination and counting for both post types', async () => {
        const { publicGroup, privateGroup, pendingGroup } = await fixture()
        await db.insert(groupPosts).values([publicGroup, privateGroup, pendingGroup].flatMap((group, index) =>
            (['announcement', 'discussion'] as const).map(type => ({
                groupId: group.id, authorId: student, type, title: `${group.slug}-${type}`, content: '正文',
                createdAt: new Date(2026, 0, index + 1),
            })),
        ))
        for (const type of [undefined, 'announcement', 'discussion'] as const) {
            const result = await GroupPostService.listByAuthor({ limit: 1, offset: 0, authorId: student, type })
            expect(result.data?.total).toBe(type ? 1 : 2)
            expect(result.data?.items).toHaveLength(1)
            expect(result.data?.items?.[0].group.id).toBe(publicGroup.id)
            if (type) expect(result.data?.items?.[0].type).toBe(type)
            const next = await GroupPostService.listByAuthor({ limit: 1, offset: type ? 1 : 2, authorId: student, type })
            expect(next.data?.items).toEqual([])
            expect(next.data?.total).toBe(type ? 1 : 2)
        }
    })
})
