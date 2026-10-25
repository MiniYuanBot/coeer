import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { and, eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData>, clear: vi.fn() }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { groups, groupMembers, groupPosts, replies, users, notifications, pointTransactions, bulletins, uploadedImages } from '~/database/schemas'
import { GroupService } from '~/services/GroupService'
import { GroupPostService } from '~/services/GroupPostService'
import { ReplyService } from '~/services/ReplyService'
import { BulletinService } from '~/services/BulletinService'
import { EngagementService } from '~/services/EngagementService'
import { MentionService } from '~/services/MentionService'
import { PointService } from '~/services/PointService'
import { uploadImage } from '~/services/ImageService'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'
import { mentionToken } from '@shared/mentions'
import { MAX_AVATAR_BYTES } from '@shared/images'

const ids: string[] = Array.from({ length: 8 }, () => randomUUID())
const [owner, admin, member, outsider, platform, applicant, extra1, extra2] = ids
function signIn(id: string) { session.data = { id, passwordVersion: createHash('sha256').update('hash').digest('hex') } }
beforeAll(initializeDatabase)
beforeEach(async () => {
    await resetDatabase()
    await db.insert(users).values(ids.map((id, index) => ({ id, name: `成员${index}`, email: `member${index}@example.test`, passwordHash: 'hash', role: id === platform ? 'admin' as const : 'student' as const })))
    signIn(owner)
})
afterAll(() => client.close())
async function fixture() {
    const [group] = await db.insert(groups).values({ name: '测试群', slug: 'feature-test', creatorId: owner, category: GROUP_CATEGORY_ARRAY[0], status: 'approved', isPublic: true }).returning()
    const roster = await db.insert(groupMembers).values([
        { groupId: group.id, userId: owner, role: 'owner' as const, status: 'approved' as const },
        { groupId: group.id, userId: admin, role: 'admin' as const, status: 'approved' as const },
        { groupId: group.id, userId: member, role: 'member' as const, status: 'approved' as const },
        { groupId: group.id, userId: applicant, role: 'member' as const, status: 'pending' as const },
        ...[extra1, extra2].map(userId => ({ groupId: group.id, userId, role: 'member' as const, status: 'approved' as const })),
    ]).returning()
    const [post] = await db.insert(groupPosts).values({ groupId: group.id, authorId: member, title: '帖子', content: '正文' }).returning()
    const [reply] = await db.insert(replies).values({ targetType: 'group_post', targetId: post.id, userId: member, content: '回复' }).returning()
    return { group, post, reply, roster, membership: (userId: string) => roster.find(item => item.userId === userId)! }
}

describe('group ownership and moderation', () => {
    it('makes the creator the sole owner', async () => {
        const result = await GroupService.create({ name: '新群组', slug: 'new-group', isPublic: true, category: GROUP_CATEGORY_ARRAY[0] })
        expect(result.success).toBe(true)
        const [created] = await db.select().from(groupMembers)
        expect(created).toMatchObject({ userId: owner, role: 'owner', status: 'approved' })
    })
    it('protects the owner from removal, demotion and leaving, and denies deletion by group admins', async () => {
        const { group, membership } = await fixture()
        signIn(admin)
        expect((await GroupService.removeMember({ memberId: membership(owner).id })).success).toBe(false)
        expect((await GroupService.updateMember({ memberId: membership(member).id, role: 'admin' })).success).toBe(false)
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(false)
        signIn(owner)
        expect((await GroupService.updateMember({ memberId: membership(owner).id, role: 'member' })).success).toBe(false)
        expect((await GroupService.leaveGroup({ groupId: group.id })).state.code).toBe('OWNER_PROTECTED')
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(true)
        expect(await db.select().from(replies)).toHaveLength(0)
    })
    it('allows a platform administrator outside the group to delete it and its discussions', async () => {
        const { group } = await fixture()
        signIn(platform)
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(true)
        expect(await db.select().from(groups)).toHaveLength(0)
        expect(await db.select().from(groupPosts)).toHaveLength(0)
        expect(await db.select().from(replies)).toHaveLength(0)
    })
    it('allows admins to review/remove members and edit/delete content but never assign roles', async () => {
        const { post, reply, membership } = await fixture()
        signIn(admin)
        expect((await GroupService.updateMember({ memberId: membership(applicant).id, status: 'approved', role: 'admin' })).success).toBe(false)
        expect((await GroupService.updateMember({ memberId: membership(applicant).id, status: 'approved' })).success).toBe(true)
        expect((await GroupPostService.update({ id: post.id, content: '管理员编辑' })).success).toBe(true)
        expect((await ReplyService.update({ id: reply.id, content: '管理员编辑回复' })).success).toBe(true)
        expect((await ReplyService.delete({ id: reply.id })).success).toBe(true)
        expect((await GroupService.removeMember({ memberId: membership(member).id })).success).toBe(true)
    })
    it('only allows a regular member to edit or delete their own content', async () => {
        const { post, reply } = await fixture()
        signIn(extra1)
        expect((await GroupPostService.update({ id: post.id, content: '越权' })).success).toBe(false)
        expect((await GroupPostService.delete({ id: post.id })).success).toBe(false)
        expect((await ReplyService.update({ id: reply.id, content: '越权' })).success).toBe(false)
        expect((await ReplyService.delete({ id: reply.id })).success).toBe(false)
        signIn(member)
        expect((await GroupPostService.update({ id: post.id, content: '自己编辑' })).success).toBe(true)
        expect((await ReplyService.update({ id: reply.id, content: '自己编辑' })).success).toBe(true)
    })
    it('serializes competing promotions to keep at most three admins', async () => {
        const { group, membership } = await fixture()
        const outcomes = await Promise.all([member, extra1, extra2].map(id => GroupService.updateMember({ memberId: membership(id).id, role: 'admin' })))
        expect(outcomes.filter(result => result.success)).toHaveLength(2)
        expect(outcomes.find(result => !result.success)?.state.code).toBe('ADMIN_LIMIT')
        expect(await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.role, 'admin')))).toHaveLength(3)
    })
    it('transfers ownership atomically and revokes the old owner permissions', async () => {
        const { group, membership } = await fixture()
        const results = await Promise.all([member, extra1].map(id => GroupService.updateMember({ memberId: membership(id).id, role: 'owner' })))
        expect(results.filter(result => result.success)).toHaveLength(1)
        const roster = await db.select().from(groupMembers)
        expect(roster.filter(m => m.role === 'owner')).toHaveLength(1)
        expect(roster.find(m => m.userId === owner)?.role).toBe('member')
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(false)
    })
    it('upgrades legacy creators and preserves ownership transfers on reruns', async () => {
        const { group, membership } = await fixture()
        await db.update(groupMembers).set({ role: 'admin' }).where(eq(groupMembers.userId, owner))
        const migration = readFileSync(new URL('../../deploy/migrations/20261026-community-roles.sql', import.meta.url), 'utf8')
        await client.exec(migration)
        expect((await db.select().from(groupMembers).where(eq(groupMembers.userId, owner)))[0].role).toBe('owner')
        expect((await GroupService.updateMember({ memberId: membership(member).id, role: 'owner' })).success).toBe(true)
        await client.exec(migration)
        expect((await db.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.role, 'owner'))))[0].userId).toBe(member)
    })
})

describe('points, notices, avatars and mentions', () => {
    it('adjusts points with an audit trail, idempotency and concurrent overdraft protection', async () => {
        const data = { userId: member, amount: 10, reason: '奖励贡献', requestId: randomUUID() }
        await expect(PointService.adjust(data)).rejects.toThrow('管理员')
        signIn(platform)
        await Promise.all([PointService.adjust(data), PointService.adjust(data)])
        expect(await db.select().from(pointTransactions)).toHaveLength(1)
        expect(await db.select().from(notifications)).toHaveLength(1)
        const attempts = await Promise.allSettled([1, 2].map(() => PointService.adjust({ ...data, amount: -8, requestId: randomUUID() })))
        expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1)
        expect((await PointService.getBalance(member)).data?.balance).toBe(2)
        expect((await db.select().from(pointTransactions))[0].description).toContain(platform)
    })
    it('reports real daily progress at Beijing midnight, excluding adjustments', async () => {
        const now = new Date('2026-10-26T16:01:00Z')
        await db.insert(pointTransactions).values([
            { userId: member, amount: 5, type: 'earn', source: 'daily_login', description: '每日活跃', createdAt: new Date('2026-10-26T16:00:00Z') },
            { userId: member, amount: 5, type: 'earn', source: 'group_post', description: '发布群组帖子', createdAt: new Date('2026-10-26T15:59:59Z') },
            { userId: member, amount: 5, type: 'earn', source: 'adjustment', description: '发布群组帖子', createdAt: now },
        ])
        const progress = await EngagementService.dailyProgress(member, now)
        expect(progress.day).toBe('2026-10-27')
        expect(progress.tasks.find(task => task.action === 'daily')?.completed).toBe(1)
        expect(progress.tasks.find(task => task.action === 'post')?.completed).toBe(0)
    })
    it('stores notification modes independently of pinning and requires a platform admin', async () => {
        const data = { type: 'official' as const, title: '公告', content: '正文', isPinned: true, notificationMode: 'modal' as const }
        expect((await BulletinService.create(data)).success).toBe(false)
        signIn(platform)
        const result = await BulletinService.create(data)
        expect(result.success).toBe(true)
        await BulletinService.update({ id: result.data!.id, notificationMode: 'banner' })
        expect((await db.select().from(bulletins))[0]).toMatchObject({ notificationMode: 'banner', isPinned: true })
        await BulletinService.update({ id: result.data!.id, notificationMode: 'none' })
        expect((await db.select().from(bulletins))[0].isPinned).toBe(true)
    })
    it('allows a member to upload their own avatar but rejects general image uploads and invalid bytes', async () => {
        signIn(member)
        const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6fEEAAAAASUVORK5CYII=', 'base64')
        const request = (path: string, body: Buffer) => new Request(`http://localhost${path}`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: new Uint8Array(body) })
        expect((await uploadImage(request('/api/images', png))).status).toBe(403)
        expect((await uploadImage(request('/api/images?purpose=avatar', Buffer.from('invalid')))).status).toBe(415)
        expect((await uploadImage(request('/api/images?purpose=avatar', Buffer.alloc(MAX_AVATAR_BYTES + 1)))).status).toBe(413)
        const oversizedHeader = request('/api/images?purpose=avatar', png)
        oversizedHeader.headers.set('Content-Length', String(MAX_AVATAR_BYTES + 1))
        expect((await uploadImage(oversizedHeader)).status).toBe(413)
        expect(await db.select().from(uploadedImages)).toHaveLength(0)
        expect((await db.select().from(users).where(eq(users.id, member)))[0].avatarUrl).toBeNull()
        const result = await uploadImage(request('/api/images?purpose=avatar', png))
        expect(result.status).toBe(201)
        const { url } = await result.json()
        expect((await db.select().from(users).where(eq(users.id, member)))[0].avatarUrl).toBe(url)
        expect((await db.select().from(users).where(eq(users.id, owner)))[0].avatarUrl).toBeNull()
        expect((await db.select().from(uploadedImages))[0].uploadedBy).toBe(member)
    })
    it('only notifies approved peers, deduplicates mentions and notifies on both posts and replies', async () => {
        const { group, post } = await fixture()
        signIn(member)
        const content = [admin, admin, member, outsider, applicant].map(id => mentionToken({ id, name: '同名' })).join(' ')
        expect((await GroupPostService.create({ groupId: group.id, type: 'discussion', title: '@测试', content })).success).toBe(true)
        let notices = await db.select().from(notifications)
        expect(notices).toHaveLength(1)
        expect(notices[0].userId).toBe(admin)
        const created = (await db.select().from(groupPosts).where(eq(groupPosts.title, '@测试')))[0]
        await GroupPostService.update({ id: created.id, content })
        expect(await db.select().from(notifications)).toHaveLength(1)
        const reply = await ReplyService.create({ targetType: 'group_post', targetId: post.id, content })
        expect(reply.success).toBe(true)
        notices = await db.select().from(notifications)
        expect(notices).toHaveLength(2)
        expect(notices.some(notice => notice.href.includes(`?mentionReply=${reply.data!.id}#mention-reply-${reply.data!.id}`))).toBe(true)
        const candidates = await MentionService.candidates({ groupId: group.id, search: '' })
        expect(candidates.some(candidate => [outsider, applicant, member].includes(candidate.id))).toBe(false)
        signIn(outsider)
        await expect(MentionService.candidates({ groupId: group.id, search: '' })).rejects.toThrow('群内成员')
    })
})
