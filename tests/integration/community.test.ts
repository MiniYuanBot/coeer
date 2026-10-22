import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import type { AppSessionData } from '@shared/contracts/auth'
import { signupSchema, studentIdFromEmail, studentIdForUser } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData>, update: vi.fn(), clear: vi.fn() }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))
vi.mock('~/utils/mail', () => ({ passwordResetMailConfigured: vi.fn(() => true), sendPasswordResetEmail: vi.fn(async () => {}) }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { AuthService } from '~/services/AuthService'
import { ActivityService } from '~/services/ActivityService'
import { FeedbackService } from '~/services/FeedbackService'
import { PointService } from '~/services/PointService'
import { RedeemService } from '~/services/RedeemService'
import { ReactionService } from '~/services/ReactionService'
import { ReplyService } from '~/services/ReplyService'
import { BookmarkService } from '~/services/BookmarkService'
import { CreateReplySchema } from '@shared/contracts/replies'
import { GroupPostService } from '~/services/GroupPostService'
import { GroupService } from '~/services/GroupService'
import { NotificationService } from '~/services/NotificationService'
import { PasswordResetService } from '~/services/PasswordResetService'
import { passwordResetMailConfigured, sendPasswordResetEmail } from '~/utils/mail'
import { canViewTarget } from '~/utils/access'
import {
    activities,
    activityParticipants,
    feedbacks,
    feedbackStatusLogs,
    groupMembers,
    groupPosts,
    groups,
    pointTransactions,
    redeemItems,
    redeemOrders,
    users,
    notifications,
    passwordResets,
    reactions,
    bookmarks,
    replies,
} from '~/database/schemas'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'

const ids = {
    student: '11111111-1111-4111-8111-111111111111',
    other: '22222222-2222-4222-8222-222222222222',
    admin: '33333333-3333-4333-8333-333333333333',
}
let passwordHash: string
function signIn(id: string = ids.student) {
    session.data = { id, passwordVersion: createHash('sha256').update(passwordHash).digest('hex') }
}
beforeAll(async () => {
    await initializeDatabase()
    passwordHash = await bcrypt.hash('test1234', 4)
    session.update.mockImplementation(async (data) => {
        session.data = data
    })
    session.clear.mockImplementation(async () => {
        session.data = {}
    })
})
beforeEach(async () => {
    vi.restoreAllMocks()
    session.update.mockImplementation(async (data) => { session.data = data })
    session.clear.mockImplementation(async () => { session.data = {} })
    await resetDatabase()
    vi.clearAllMocks()
    session.data = {}
    await db.insert(users).values([
        { id: ids.student, email: 'student@example.test', name: '学生', passwordHash, role: 'student' },
        { id: ids.other, email: 'other@example.test', name: '其他学生', passwordHash, role: 'student' },
        { id: ids.admin, email: 'admin@example.test', name: '管理员', passwordHash, role: 'admin' },
    ])
})

describe('COEER post interactions and author permissions', () => {
    async function postFixture(isPublic = true) {
        const [group] = await db.insert(groups).values({ name: '讨论组', slug: 'post-test', category: GROUP_CATEGORY_ARRAY[0], creatorId: ids.admin, status: 'approved', isPublic }).returning()
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.admin, role: 'admin', status: 'approved' })
        const [post] = await db.insert(groupPosts).values({ groupId: group.id, authorId: ids.student, title: '测试帖子', content: '讨论内容', type: 'discussion' }).returning()
        return { group, post }
    }
    it('persists bookmarks idempotently, isolates accounts, and removes them when the post is deleted', async () => {
        const { post } = await postFixture()
        await expect(BookmarkService.set({ postId: post.id, bookmarked: true })).rejects.toThrow('请先登录')
        signIn()
        await Promise.all([BookmarkService.set({ postId: post.id, bookmarked: true }), BookmarkService.set({ postId: post.id, bookmarked: true })])
        expect(await db.select().from(bookmarks)).toHaveLength(1)
        expect((await GroupPostService.getById({ id: post.id })).data?.isBookmarked).toBe(true)
        await ReactionService.toggle({ targetType: 'group_post', targetId: post.id })
        expect((await BookmarkService.list({ limit: 10, offset: 0 })).items[0].post).toMatchObject({ id: post.id, hasReacted: true, reactionCount: 1 })
        signIn(ids.other)
        expect((await BookmarkService.list({ limit: 10, offset: 0 })).total).toBe(0)
        expect((await GroupPostService.getById({ id: post.id })).data?.isBookmarked).toBe(false)
        await BookmarkService.set({ postId: post.id, bookmarked: false })
        expect(await db.select().from(bookmarks)).toHaveLength(1)
        signIn()
        await BookmarkService.set({ postId: post.id, bookmarked: false })
        expect((await BookmarkService.list({ limit: 10, offset: 0 })).total).toBe(0)
        await BookmarkService.set({ postId: post.id, bookmarked: true })
        await GroupPostService.delete({ id: post.id })
        expect(await db.select().from(bookmarks)).toHaveLength(0)
        expect(await db.select().from(reactions)).toHaveLength(0)
    })
    it('checks bookmark visibility before pagination and allows removing inaccessible saved posts', async () => {
        const { group, post } = await postFixture(false)
        signIn()
        await expect(BookmarkService.set({ postId: post.id, bookmarked: true })).rejects.toThrow('无权查看')
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.student, role: 'member', status: 'approved' })
        await BookmarkService.set({ postId: post.id, bookmarked: true })
        const [publicGroup] = await db.insert(groups).values({ name: '公开组', slug: 'public-bookmark', category: GROUP_CATEGORY_ARRAY[0], status: 'approved', isPublic: true }).returning()
        const [publicPost] = await db.insert(groupPosts).values({ groupId: publicGroup.id, title: '公开内容', content: '公开', type: 'discussion' }).returning()
        await BookmarkService.set({ postId: publicPost.id, bookmarked: true })
        await db.delete(groupMembers).where(eq(groupMembers.userId, ids.student))
        const page = await BookmarkService.list({ limit: 1, offset: 0 })
        expect(page.total).toBe(1)
        expect(page.items.map((item) => item.post.id)).toEqual([publicPost.id])
        await BookmarkService.set({ postId: post.id, bookmarked: false })
        expect(await db.select().from(bookmarks)).toHaveLength(1)
    })
    it('restricts all reply reads and writes to group members, and gives group admins moderation rights', async () => {
        const { group, post } = await postFixture()
        const target = { targetType: 'group_post' as const, targetId: post.id }
        const page = { ...target, limit: 10, offset: 0 }
        expect(CreateReplySchema.safeParse({ ...target, content: '   ' }).success).toBe(false)
        expect((await ReplyService.create({ ...target, content: '游客回复' })).success).toBe(false)
        signIn()
        expect((await ReplyService.create({ ...target, content: '未加入的公开群' })).success).toBe(false)
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.student, role: 'member', status: 'approved' })
        const root = (await ReplyService.create({ ...target, content: String.raw`令 $u=x^2$，答案是 $\frac{e-1}{2}$。` })).data!
        expect(root?.id).toBeTruthy()
        const child = (await ReplyService.create({ ...target, parentId: root.id, content: '谢谢！' })).data!
        expect(child.parentId).toBe(root.id)
        expect((await ReplyService.update({ id: root.id, content: '更正后的推导' })).success).toBe(true)
        const [anotherPost] = await db.insert(groupPosts).values({ groupId: group.id, title: '另一个帖子', content: '讨论' }).returning()
        expect((await ReplyService.create({ ...target, targetId: anotherPost.id, parentId: root.id, content: '跨帖回复' })).success).toBe(false)
        expect((await ReplyService.create({ ...target, targetType: 'feedback', content: '反馈回复不开放' })).success).toBe(false)
        signIn(ids.other)
        expect((await ReplyService.getById({ id: root.id })).success).toBe(false)
        expect((await ReplyService.listByTarget(page)).success).toBe(false)
        expect((await ReplyService.listChildren({ parentId: root.id, limit: 10, offset: 0 })).success).toBe(false)
        expect((await ReplyService.listByAuthor({ authorId: ids.student, limit: 10, offset: 0 })).data?.items).toHaveLength(0)
        expect((await ReplyService.update({ id: root.id, content: '越权' })).success).toBe(false)
        expect((await ReplyService.delete({ id: root.id })).success).toBe(false)
        const [applicant] = await db.insert(groupMembers).values({ groupId: group.id, userId: ids.other, role: 'admin', status: 'pending' }).returning()
        expect((await ReplyService.create({ ...target, content: '待审核管理员' })).success).toBe(false)
        expect((await ReplyService.delete({ id: root.id })).success).toBe(false)
        await db.update(groupMembers).set({ status: 'approved' }).where(eq(groupMembers.id, applicant.id))
        expect((await ReplyService.listByTarget(page)).data?.total).toBe(2)
        expect((await ReplyService.update({ id: root.id, content: '管理员不能冒充作者编辑' })).success).toBe(false)
        expect((await ReplyService.delete({ id: root.id })).success).toBe(true)
        expect((await ReplyService.getById({ id: child.id })).data?.content).toBe('谢谢！')
        signIn()
        expect((await ReplyService.update({ id: root.id, content: '不能恢复被管理删除的内容' })).success).toBe(false)
        signIn(ids.admin)
        await GroupPostService.delete({ id: post.id })
        expect(await db.select().from(replies)).toHaveLength(0)
    })
    it('filters reply author histories before pagination and revokes access after leaving a group', async () => {
        const { group, post } = await postFixture(false)
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.student, role: 'member', status: 'approved' })
        signIn()
        const created = await ReplyService.create({ targetType: 'group_post', targetId: post.id, content: '私密讨论' })
        expect(created.success).toBe(true)
        await db.delete(groupMembers).where(eq(groupMembers.userId, ids.student))
        expect((await ReplyService.getById({ id: created.data!.id })).success).toBe(false)
        expect((await ReplyService.listByAuthor({ authorId: ids.student, limit: 1, offset: 0 })).data?.items).toHaveLength(0)
        expect((await ReplyService.delete({ id: created.data!.id })).success).toBe(false)
        session.data = {}
        expect((await ReplyService.getById({ id: created.data!.id })).success).toBe(false)
        expect((await ReplyService.listByTarget({ targetType: 'group_post', targetId: post.id, limit: 10, offset: 0 })).success).toBe(false)
    })
    it('persists like counts and the viewer state, including unlike and concurrent toggles', async () => {
        const { group, post } = await postFixture()
        signIn()
        const target = { targetType: 'group_post' as const, targetId: post.id }
        expect((await ReactionService.toggle(target)).data).toEqual({ reacted: true, count: 1 })
        expect((await GroupPostService.getById({ id: post.id })).data).toMatchObject({ reactionCount: 1, hasReacted: true })
        signIn(ids.other)
        expect((await GroupPostService.listByGroup({ groupId: group.id, limit: 10, offset: 0 })).data?.items?.[0]).toMatchObject({ reactionCount: 1, hasReacted: false })
        signIn()
        expect((await ReactionService.toggle(target)).data).toEqual({ reacted: false, count: 0 })
        const result = await Promise.all([ReactionService.toggle(target), ReactionService.toggle(target)])
        expect(result.every((item) => item.success)).toBe(true)
        expect(await db.select().from(reactions)).toHaveLength(0)
    })
    it('protects private post likes and only permits authors or approved group administrators to modify content', async () => {
        const { group, post } = await postFixture(false)
        signIn(ids.other)
        const target = { targetType: 'group_post' as const, targetId: post.id }
        expect((await ReactionService.toggle(target)).success).toBe(false)
        expect((await ReactionService.listByTarget({ ...target, limit: 10, offset: 0 })).success).toBe(false)
        expect((await GroupPostService.update({ id: post.id, title: '越权编辑' })).success).toBe(false)
        expect((await GroupPostService.delete({ id: post.id })).success).toBe(false)
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.other, role: 'admin', status: 'pending' })
        expect((await GroupPostService.update({ id: post.id, title: '待审核管理员编辑' })).success).toBe(false)
        signIn()
        expect((await GroupPostService.update({ id: post.id, title: '作者编辑' })).success).toBe(true)
        signIn(ids.admin)
        expect((await GroupPostService.update({ id: post.id, title: '群管理员编辑' })).success).toBe(true)
        expect((await GroupPostService.delete({ id: post.id })).success).toBe(true)
    })
})

describe('COEER group administrator capabilities', () => {
    async function fixture() {
        const [group] = await db.insert(groups).values({ name: '管理测试', slug: 'management', category: GROUP_CATEGORY_ARRAY[0], creatorId: ids.student, status: 'approved', isPublic: false }).returning()
        const [owner, member, applicant] = await db.insert(groupMembers).values([
            { groupId: group.id, userId: ids.student, role: 'admin', status: 'approved' },
            { groupId: group.id, userId: ids.other, role: 'member', status: 'approved' },
            { groupId: group.id, userId: ids.admin, role: 'member', status: 'pending' },
        ]).returning()
        return { group, owner, member, applicant }
    }
    it('allows group admins to review members, set roles and moderate posts without platform review powers', async () => {
        const { group, member, applicant } = await fixture()
        signIn(ids.other)
        expect((await GroupService.update({ id: group.id, name: '越权修改' })).success).toBe(false)
        expect((await GroupService.updateMember({ memberId: applicant.id, status: 'approved' })).success).toBe(false)
        expect((await GroupService.removeMember({ memberId: applicant.id })).success).toBe(false)
        signIn()
        expect((await GroupService.update({ id: group.id, name: '更新群名' })).success).toBe(true)
        expect((await GroupService.updateGroupStatus({ id: group.id, status: 'rejected' })).success).toBe(false)
        expect((await GroupService.updateMember({ memberId: applicant.id, status: 'approved' })).success).toBe(true)
        expect((await GroupService.updateMember({ memberId: member.id, role: 'admin' })).success).toBe(true)
        // Status-only updates have no implicit role downgrade.
        const { UpdateGroupMemberSchema } = await import('@shared/contracts/groupMembers')
        expect(UpdateGroupMemberSchema.parse({ memberId: member.id, status: 'approved' }).role).toBeUndefined()
        signIn(ids.other)
        const [post] = await db.insert(groupPosts).values({ groupId: group.id, authorId: ids.student, title: '管理帖子', content: '正文' }).returning()
        expect((await GroupPostService.togglePin({ id: post.id, isPinned: true })).success).toBe(true)
        expect((await GroupPostService.update({ id: post.id, content: '管理员修订' })).success).toBe(true)
        expect((await GroupPostService.delete({ id: post.id })).success).toBe(true)
        expect((await GroupService.removeMember({ memberId: applicant.id })).success).toBe(true)
    })
    it('protects the last admin from removal, demotion, leaving and concurrent role changes', async () => {
        const { group, owner, member } = await fixture()
        signIn()
        expect((await GroupService.updateMember({ memberId: owner.id, role: 'member' })).state.code).toBe('LAST_ADMIN')
        expect((await GroupService.removeMember({ memberId: owner.id })).state.code).toBe('LAST_ADMIN')
        expect((await GroupService.leaveGroup({ groupId: group.id })).state.code).toBe('LAST_ADMIN')
        await GroupService.updateMember({ memberId: member.id, role: 'admin' })
        const results = await Promise.all([
            GroupService.updateMember({ memberId: owner.id, role: 'member' }),
            GroupService.updateMember({ memberId: member.id, role: 'member' }),
        ])
        expect(results.filter((result) => result.success)).toHaveLength(1)
        const admins = (await db.select().from(groupMembers).where(eq(groupMembers.groupId, group.id))).filter((item) => item.role === 'admin' && item.status === 'approved')
        expect(admins).toHaveLength(1)
    })
    it('revokes a creator’s management rights after removal and keeps unreviewed groups manageable by their admins', async () => {
        const { group, owner, member } = await fixture()
        signIn()
        await GroupService.updateMember({ memberId: member.id, role: 'admin' })
        signIn(ids.other)
        expect((await GroupService.removeMember({ memberId: owner.id })).success).toBe(true)
        signIn()
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(false)
        signIn(ids.other)
        await db.update(groups).set({ status: 'pending' }).where(eq(groups.id, group.id))
        expect((await GroupService.getMembers({ groupId: group.id, limit: 10, offset: 0 })).success).toBe(true)
        expect((await GroupService.delete({ groupId: group.id })).success).toBe(true)
    })
})

describe('COEER notification delivery and ownership', () => {
    it('notifies from the review action used by the management dashboard without duplicating unchanged results', async () => {
        const [group] = await db.insert(groups).values({ name: '后台审核组', slug: 'dashboard-review', category: GROUP_CATEGORY_ARRAY[0], creatorId: ids.student, status: 'pending' }).returning()
        signIn(ids.admin)
        expect((await GroupService.updateGroupStatus({ id: group.id, status: 'rejected', rejectedReason: '请补充群组介绍' })).success).toBe(true)
        expect((await GroupService.updateGroupStatus({ id: group.id, status: 'rejected', rejectedReason: '请补充群组介绍' })).success).toBe(true)
        const messages = await db.select().from(notifications)
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({ userId: ids.student, type: 'group_review' })
        expect(messages[0].content).toContain('请补充群组介绍')
        signIn(ids.other)
        expect((await GroupService.updateGroupStatus({ id: group.id, status: 'approved' })).success).toBe(false)
        expect(await db.select().from(notifications)).toHaveLength(1)
    })
    it('isolates inboxes and keeps single/all read operations scoped to the session owner', async () => {
        const [own, foreign] = await db.insert(notifications).values([
            { userId: ids.student, type: 'test', title: '我的消息', content: '处理进展', href: '/feedbacks' },
            { userId: ids.other, type: 'test', title: '其他消息', content: '其他进展', href: '/groups' },
        ]).returning()
        signIn()
        expect((await NotificationService.list({ limit: 10, offset: 0, unreadOnly: false })).items.map((item) => item.id)).toEqual([own.id])
        await NotificationService.markRead(foreign.id)
        expect(await NotificationService.unreadCount()).toBe(1)
        await NotificationService.markRead(own.id)
        await NotificationService.markRead(own.id)
        expect(await NotificationService.unreadCount()).toBe(0)
        expect((await NotificationService.list({ limit: 10, offset: 0, unreadOnly: true })).total).toBe(0)
        await NotificationService.markRead()
        expect((await db.select().from(notifications).where(eq(notifications.id, foreign.id)))[0].readAt).toBeNull()
        session.data = {}
        await expect(NotificationService.list({ limit: 10, offset: 0, unreadOnly: false })).rejects.toThrow('请先登录')
    })
    it('notifies feedback authors and rolls back the status/log if notification persistence fails', async () => {
        signIn()
        const created = await FeedbackService.create({ title: '反馈测试', content: '需要处理的问题', targetType: 'general', isAnonymous: true })
        const id = created.data!.id
        signIn(ids.admin)
        expect((await FeedbackService.updateStatus({ id, status: 'processing' })).success).toBe(true)
        expect((await db.select().from(notifications))[0]).toMatchObject({ userId: ids.student, type: 'feedback_status', href: `/feedbacks/${id}` })
        expect((await FeedbackService.updateStatus({ id, status: 'processing' })).success).toBe(true)
        expect(await db.select().from(notifications)).toHaveLength(1)
        const logCount = (await db.select().from(feedbackStatusLogs)).length
        const failure = vi.spyOn(NotificationService, 'create').mockRejectedValueOnce(new Error('simulated notification failure'))
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
        expect((await FeedbackService.updateStatus({ id, status: 'resolved' })).success).toBe(false)
        expect((await db.select().from(feedbacks).where(eq(feedbacks.id, id)))[0].status).toBe('processing')
        expect(await db.select().from(feedbackStatusLogs)).toHaveLength(logCount)
        expect(await db.select().from(notifications)).toHaveLength(1)
        failure.mockRestore(); errors.mockRestore()
    })
    it('delivers group and membership review results to the applicant', async () => {
        const [group] = await db.insert(groups).values({ name: '审核组', slug: 'review-test', category: GROUP_CATEGORY_ARRAY[0], creatorId: ids.student, status: 'pending', isPublic: false }).returning()
        await db.insert(groupMembers).values({ groupId: group.id, userId: ids.student, role: 'admin', status: 'approved' })
        signIn(ids.admin)
        const reviews = await Promise.all([GroupService.approveGroup({ id: group.id, approved: true }), GroupService.approveGroup({ id: group.id, approved: false })])
        expect(reviews.filter((result) => result.success)).toHaveLength(1)
        expect(await db.select().from(notifications)).toHaveLength(1)
        expect((await db.select().from(notifications))[0]).toMatchObject({ userId: ids.student, type: 'group_review' })
        const [member] = await db.insert(groupMembers).values({ groupId: group.id, userId: ids.other, role: 'member', status: 'pending' }).returning()
        signIn()
        expect((await GroupService.updateMember({ memberId: member.id, role: 'member', status: 'rejected' })).success).toBe(true)
        expect((await db.select().from(notifications).where(eq(notifications.userId, ids.other)))[0]).toMatchObject({ type: 'membership_review', href: '/groups' })
    })
})

describe('COEER activity time progression', () => {
    async function activityFixture(start: number, end: number, status: 'upcoming' | 'ongoing' | 'cancelled' = 'upcoming') {
        const [activity] = await db.insert(activities).values({ title: '时间测试', description: '活动时间边界', organizerType: 'user', organizerId: ids.admin, type: 'official', startTime: new Date(Date.now() + start), endTime: new Date(Date.now() + end), maxParticipants: 1, status }).returning()
        return activity
    }
    it('advances expired and started activities before filtering or counting, preserving cancellation', async () => {
        const ended = await activityFixture(-7200000, -3600000)
        const ongoing = await activityFixture(-3600000, 3600000)
        const cancelled = await activityFixture(-7200000, -3600000, 'cancelled')
        await activityFixture(3600000, 7200000)
        const result = await ActivityService.list({ status: 'upcoming', limit: 10, offset: 0 })
        expect(result.data?.total).toBe(1)
        expect(result.data?.items).toHaveLength(1)
        expect((await ActivityService.getById({ id: ended.id })).data?.status).toBe('completed')
        expect((await ActivityService.getById({ id: ongoing.id })).data?.status).toBe('ongoing')
        expect((await ActivityService.getById({ id: cancelled.id })).data?.status).toBe('cancelled')
        signIn()
        expect((await ActivityService.register({ activityId: ended.id })).success).toBe(false)
        expect((await ActivityService.register({ activityId: ongoing.id })).success).toBe(false)
        expect(await db.select().from(notifications)).toHaveLength(0)
    })
    it('allows administrators to register with a reserved display ID and exposes only the viewer registration', async () => {
        const activity = await activityFixture(3600000, 7200000)
        signIn(ids.admin)
        expect((await AuthService.getCurrentUser()).data?.studentId).toBe('0000000000')
        expect((await ActivityService.getById({ id: activity.id })).data?.myParticipation).toBeNull()
        expect((await ActivityService.register({ activityId: activity.id })).success).toBe(true)
        const [participant] = await db.select().from(activityParticipants)
        expect(participant.userId).toBe(ids.admin)
        expect((await ActivityService.getById({ id: activity.id })).data?.myParticipation).toEqual({ id: participant.id, status: 'registered' })
        expect((await ActivityService.list({ limit: 10, offset: 0 })).data?.items?.[0].myParticipation).toEqual({ id: participant.id, status: 'registered' })
        expect(await ActivityService.register({ activityId: activity.id })).toMatchObject({ success: true, state: { code: 'ALREADY_REGISTERED' } })
        expect(await db.select().from(activityParticipants)).toHaveLength(1)
        expect(await db.select().from(notifications)).toHaveLength(1)
        const roster = await ActivityService.listParticipants({ activityId: activity.id, limit: 10, offset: 0 })
        expect(roster.data?.items?.[0].user).toEqual({ id: ids.admin, name: '管理员', studentId: '0000000000' })
        signIn(ids.other)
        expect((await ActivityService.getById({ id: activity.id })).data?.myParticipation).toBeNull()
        expect((await ActivityService.register({ activityId: activity.id })).state.code).toBe('ACTIVITY_FULL')
        session.data = {}
        expect((await ActivityService.getById({ id: activity.id })).data?.myParticipation).toBeNull()
    })
    it('keeps activity time and capacity limits when an administrator participates', async () => {
        const activity = await activityFixture(3600000, 7200000)
        signIn()
        expect((await ActivityService.register({ activityId: activity.id })).success).toBe(true)
        signIn(ids.admin)
        expect((await ActivityService.register({ activityId: activity.id })).state.code).toBe('ACTIVITY_FULL')
        const ended = await activityFixture(-7200000, -3600000)
        expect((await ActivityService.register({ activityId: ended.id })).success).toBe(false)
    })
    it('supports re-registration after cancellation and only notifies successful registrations', async () => {
        const activity = await activityFixture(3600000, 7200000)
        signIn()
        expect((await ActivityService.register({ activityId: activity.id })).success).toBe(true)
        const [participant] = await db.select().from(activityParticipants)
        expect(await ActivityService.register({ activityId: activity.id })).toMatchObject({ success: true, state: { code: 'ALREADY_REGISTERED' } })
        expect(await db.select().from(notifications)).toHaveLength(1)
        expect((await ActivityService.cancelRegistration({ participantId: participant.id })).success).toBe(true)
        expect((await ActivityService.register({ activityId: activity.id })).success).toBe(true)
        expect(await db.select().from(activityParticipants)).toHaveLength(1)
        expect(await db.select().from(notifications)).toHaveLength(2)
    })
    it('authorizes cancellation by owner or organizer, releases capacity and refreshes viewer status', async () => {
        const activity = await activityFixture(3600000, 7200000)
        signIn()
        await ActivityService.register({ activityId: activity.id })
        const [participant] = await db.select().from(activityParticipants)
        session.data = {}
        expect((await ActivityService.cancelRegistration({ participantId: participant.id })).success).toBe(false)
        signIn(ids.other)
        expect((await ActivityService.cancelRegistration({ participantId: participant.id })).success).toBe(false)
        expect((await ActivityService.register({ activityId: activity.id })).state.code).toBe('ACTIVITY_FULL')
        signIn()
        expect((await ActivityService.cancelRegistration({ participantId: participant.id })).success).toBe(true)
        expect((await ActivityService.getById({ id: activity.id })).data?.myParticipation?.status).toBe('cancelled')
        signIn(ids.other)
        expect((await ActivityService.register({ activityId: activity.id })).success).toBe(true)
        const other = (await db.select().from(activityParticipants)).find((item) => item.userId === ids.other)!
        signIn(ids.admin)
        expect((await ActivityService.cancelRegistration({ participantId: other.id })).success).toBe(true)
    })
    it('serializes competing registrations for the last available place', async () => {
        const activity = await activityFixture(3600000, 7200000)
        const auth = vi.spyOn(AuthService, 'getCurrentUser')
        auth.mockResolvedValueOnce({ success: true, data: { id: ids.student, email: 'student@example.test', name: '学生', role: 'student', lastUpdated: Date.now() }, state: { code: 'GET_SUCCESS' } })
        auth.mockResolvedValueOnce({ success: true, data: { id: ids.other, email: 'other@example.test', name: '其他学生', role: 'student', lastUpdated: Date.now() }, state: { code: 'GET_SUCCESS' } })
        const results = await Promise.all([ActivityService.register({ activityId: activity.id }), ActivityService.register({ activityId: activity.id })])
        expect(results.filter((result) => result.success)).toHaveLength(1)
        expect(await db.select().from(activityParticipants)).toHaveLength(1)
        expect(await db.select().from(notifications)).toHaveLength(1)
        auth.mockRestore()
    })
})

describe('COEER password recovery', () => {
    function sentToken() { return vi.mocked(sendPasswordResetEmail).mock.calls.at(-1)![1] }
    it('uses generic responses and persistent rate limits, storing only a digest of the token', async () => {
        expect((await PasswordResetService.request({ email: 'student@example.test' })).success).toBe(true)
        const token = sentToken()
        const [stored] = await db.select().from(passwordResets)
        expect(stored.tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
        expect(JSON.stringify(stored)).not.toContain(token)
        const known = await PasswordResetService.request({ email: 'student@example.test' })
        const unknown = await PasswordResetService.request({ email: 'nobody@example.test' })
        expect(known).toEqual(unknown)
        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1)
        expect(await db.select().from(passwordResets)).toHaveLength(2)
    })
    it('consumes links once, changes the password and revokes old sessions', async () => {
        await PasswordResetService.request({ email: 'student@example.test' })
        const token = sentToken()
        signIn()
        expect((await PasswordResetService.reset({ token, newPassword: 'updated-password-2026' })).success).toBe(true)
        expect((await AuthService.getCurrentUser()).success).toBe(false)
        expect((await PasswordResetService.reset({ token, newPassword: 'another-password-2026' })).success).toBe(false)
        expect((await AuthService.login({ email: 'student@example.test', password: 'test1234' })).success).toBe(false)
        expect((await AuthService.login({ email: 'student@example.test', password: 'updated-password-2026' })).success).toBe(true)
    })
    it('rejects expired links, disabled users, changed credentials and invalid password lengths', async () => {
        await PasswordResetService.request({ email: 'student@example.test' })
        const token = sentToken()
        expect((await PasswordResetService.reset({ token, newPassword: 'short' })).success).toBe(false)
        expect((await PasswordResetService.reset({ token, newPassword: '密'.repeat(25) })).success).toBe(false)
        await db.update(passwordResets).set({ expiresAt: new Date(Date.now() - 1000) })
        expect((await PasswordResetService.reset({ token, newPassword: 'updated-password-2026' })).success).toBe(false)
        await db.update(passwordResets).set({ expiresAt: new Date(Date.now() + 60000) })
        await db.update(users).set({ isActive: false }).where(eq(users.id, ids.student))
        expect((await PasswordResetService.reset({ token, newPassword: 'updated-password-2026' })).success).toBe(false)
        await db.update(users).set({ isActive: true, passwordHash: await bcrypt.hash('changed-password', 4) }).where(eq(users.id, ids.student))
        expect((await PasswordResetService.reset({ token, newPassword: 'updated-password-2026' })).success).toBe(false)
    })
    it('does not report success when mail is unavailable', async () => {
        vi.mocked(passwordResetMailConfigured).mockReturnValueOnce(false)
        expect((await PasswordResetService.request({ email: 'student@example.test' })).state.code).toBe('MAIL_UNAVAILABLE')
        expect(await db.select().from(passwordResets)).toHaveLength(0)
        vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('delivery failed'))
        expect((await PasswordResetService.request({ email: 'student@example.test' })).state.code).toBe('MAIL_UNAVAILABLE')
        expect((await db.select().from(passwordResets))[0].consumedAt).not.toBeNull()
    })
})
afterAll(async () => {
    await client.close()
})

describe('COEER accounts and server permissions', () => {
    it('validates passwords, stores only public session data and logs out', async () => {
        expect(
            (await AuthService.login({ email: 'student@example.test', password: 'wrong-password' })).success,
        ).toBe(false)
        expect(session.update).not.toHaveBeenCalled()
        expect(
            (await AuthService.login({ email: 'student@example.test', password: 'test1234' })).success,
        ).toBe(true)
        expect(session.data).toMatchObject({ id: ids.student, role: 'student', name: '学生' })
        expect(session.data).not.toHaveProperty('passwordHash')
        await AuthService.logout()
        expect(session.data).toEqual({})
    })
    it('revalidates roles and immediately revokes disabled accounts', async () => {
        signIn()
        session.data.role = 'admin'
        expect((await AuthService.getCurrentUser()).data?.role).toBe('student')
        await db.update(users).set({ isActive: false }).where(eq(users.id, ids.student))
        expect((await AuthService.getCurrentUser()).success).toBe(false)
        expect(session.clear).toHaveBeenCalledOnce()
        expect(
            (await AuthService.login({ email: 'student@example.test', password: 'test1234' })).state.code,
        ).toBe('ACCOUNT_INACTIVE')
    })
    it('registers a student and rejects an existing email with another password', async () => {
        expect(
            (await AuthService.signup({ email: '2026201234@stu.pku.edu.cn', password: 'new-password-2026' })).success,
        ).toBe(true)
        expect(session.data.role).toBe('student')
        const id = session.data.id
        await AuthService.logout()
        expect(
            (await AuthService.signup({ email: '2026201234@stu.pku.edu.cn', password: 'wrong-password' })).success,
        ).toBe(false)
        expect(session.data.id).toBeUndefined()
        expect(
            (await AuthService.login({ email: '2026201234@stu.pku.edu.cn', password: 'new-password-2026' })).success,
        ).toBe(true)
        expect(session.data.id).toBe(id)
    })
    it('only registers exact student email addresses and never accepts a supplied admin role', async () => {
        for (const email of ['new@example.test', '0000000000@stu.pku.edu.cn', '123456789@stu.pku.edu.cn', '12345678901@stu.pku.edu.cn', 'abcdefghij@stu.pku.edu.cn', '2026201234@pku.edu.cn', '2026201234@stu.pku.edu.cn.attacker.test']) {
            expect(signupSchema.safeParse({ email, password: 'test1234' }).success).toBe(false)
            expect((await AuthService.signup({ email, password: 'test1234' })).success).toBe(false)
        }
        expect(studentIdFromEmail('2026201234@stu.pku.edu.cn')).toBe('2026201234')
        expect(studentIdFromEmail('admin@example.test')).toBeUndefined()
        expect(studentIdFromEmail('0000000000@stu.pku.edu.cn')).toBeUndefined()
        expect(studentIdForUser({ role: 'admin', email: '2026201234@stu.pku.edu.cn' })).toBe('0000000000')
        expect(studentIdForUser({ role: 'student', email: '0000000000@stu.pku.edu.cn' })).toBeUndefined()
        expect(await db.select().from(users)).toHaveLength(3)
        const input = { email: '2026201234@stu.pku.edu.cn', password: 'test1234', role: 'admin' }
        expect((await AuthService.signup(input)).success).toBe(true)
        expect(session.data.role).toBe('student')
        expect((await db.select().from(users).where(eq(users.email, input.email)))[0].role).toBe('student')
    })
    it('allows existing administrators to log in with a non-student email', async () => {
        expect((await AuthService.login({ email: 'admin@example.test', password: 'test1234' })).success).toBe(true)
        expect((await AuthService.getCurrentUser()).data).toMatchObject({ role: 'admin', studentId: '0000000000', email: 'admin@example.test' })
        expect((await AuthService.getCurrentUser()).data).not.toHaveProperty('passwordVersion')
    })
    it('removes the reserved student ID when an administrator role is revoked', async () => {
        signIn(ids.admin)
        expect((await AuthService.getCurrentUser()).data?.studentId).toBe('0000000000')
        await db.update(users).set({ role: 'student' }).where(eq(users.id, ids.admin))
        expect((await AuthService.getCurrentUser()).data).toMatchObject({ id: ids.admin, role: 'student', studentId: undefined })
    })
    it('updates only the signed-in account nickname, keeping its role and password private', async () => {
        signIn()
        const result = await AuthService.updateProfile({ name: '  新昵称  ', id: ids.other, role: 'admin' } as { name: string })
        expect(result.success).toBe(true)
        expect(result.data).toMatchObject({ id: ids.student, name: '新昵称', role: 'student' })
        expect(result.data).not.toHaveProperty('passwordHash')
        expect(result.data).not.toHaveProperty('passwordVersion')
        expect(session.data.name).toBe('新昵称')
        expect((await AuthService.getCurrentUser()).data?.name).toBe('新昵称')
        expect((await db.select().from(users).where(eq(users.id, ids.other)))[0].name).toBe('其他学生')
        expect((await AuthService.updateProfile({ name: '  ' })).success).toBe(false)
        expect((await AuthService.updateProfile({ name: '名'.repeat(64) })).success).toBe(false)
    })
    it('requires the current password and validates bcrypt byte limits before changing credentials', async () => {
        signIn()
        expect((await AuthService.changePassword({ currentPassword: 'wrong-password', newPassword: 'new-password-2026' })).state.code).toBe('INVALID_CURRENT_PASSWORD')
        expect((await AuthService.changePassword({ currentPassword: 'test1234', newPassword: 'short' })).success).toBe(false)
        expect((await AuthService.changePassword({ currentPassword: 'test1234', newPassword: '密'.repeat(25) })).success).toBe(false)
        expect(session.clear).not.toHaveBeenCalled()
        expect((await db.select().from(users).where(eq(users.id, ids.student)))[0].passwordHash).toBe(passwordHash)
    })
    it('changes the password, signs out the caller and revokes every previously issued session', async () => {
        signIn()
        const oldSession = { ...session.data }
        expect((await AuthService.changePassword({ currentPassword: 'test1234', newPassword: 'new-password-2026' })).success).toBe(true)
        expect(session.data).toEqual({})
        const [user] = await db.select().from(users).where(eq(users.id, ids.student))
        expect(user.passwordHash).not.toBe('new-password-2026')
        expect(await bcrypt.compare('new-password-2026', user.passwordHash)).toBe(true)
        session.data = oldSession
        expect((await AuthService.getCurrentUser()).success).toBe(false)
        expect(session.data).toEqual({})
        expect((await AuthService.login({ email: 'student@example.test', password: 'test1234' })).success).toBe(false)
        expect((await AuthService.login({ email: 'student@example.test', password: 'new-password-2026' })).success).toBe(true)
        expect((await AuthService.getCurrentUser()).success).toBe(true)
    })
    it('rejects unauthenticated account edits and sessions without a credential version', async () => {
        expect((await AuthService.updateProfile({ name: '越权昵称' })).success).toBe(false)
        expect((await AuthService.changePassword({ currentPassword: 'test1234', newPassword: 'new-password-2026' })).success).toBe(false)
        session.data = { id: ids.student }
        expect((await AuthService.getCurrentUser()).success).toBe(false)
        expect(session.clear).toHaveBeenCalledOnce()
    })
    it('rejects unauthenticated writes across feedback, activities and the store', async () => {
        expect(
            (
                await FeedbackService.create({
                    title: '反馈',
                    content: '反馈内容',
                    targetType: 'general',
                    isAnonymous: false,
                })
            ).success,
        ).toBe(false)
        expect(
            (
                await ActivityService.create({
                    title: '活动',
                    description: '活动内容',
                    type: 'official',
                    startTime: new Date(),
                    endTime: new Date(Date.now() + 3600000),
                })
            ).success,
        ).toBe(false)
        expect((await RedeemService.redeem({ itemId: ids.student, quantity: 1 })).success).toBe(false)
        expect(await db.select().from(feedbacks)).toHaveLength(0)
        expect(await db.select().from(activities)).toHaveLength(0)
        expect(await db.select().from(redeemOrders)).toHaveLength(0)
    })
})

describe('COEER feedback and content visibility', () => {
    it('audits feedback state changes and hides anonymous authors from ordinary readers', async () => {
        signIn()
        const created = await FeedbackService.create({
            title: '匿名反馈',
            content: '希望延长开放时间',
            targetType: 'general',
            isAnonymous: true,
        })
        expect(created.success).toBe(true)
        const id = created.data!.id
        expect(await db.select().from(feedbackStatusLogs)).toHaveLength(1)
        signIn(ids.other)
        expect((await FeedbackService.getById({ id })).success).toBe(false)
        expect((await FeedbackService.updateStatus({ id, status: 'resolved', isPublic: true })).success).toBe(
            false,
        )
        signIn(ids.admin)
        expect(
            (
                await FeedbackService.updateStatus({
                    id,
                    status: 'processing',
                    isPublic: true,
                    note: '已受理，公开处理进度',
                })
            ).success,
        ).toBe(true)
        expect((await FeedbackService.getById({ id })).data?.author?.id).toBe(ids.student)
        signIn(ids.other)
        const publicFeedback = await FeedbackService.getById({ id })
        expect(publicFeedback.success).toBe(true)
        expect(publicFeedback.data?.author).toBeUndefined()
        expect(publicFeedback.data?.status).toBe('processing')
        expect(await db.select().from(feedbackStatusLogs)).toHaveLength(2)
    })
    it('keeps private posts hidden until membership approval', async () => {
        const [group] = await db
            .insert(groups)
            .values({
                name: '私密小组',
                slug: 'private-group',
                creatorId: ids.admin,
                category: GROUP_CATEGORY_ARRAY[0],
                isPublic: false,
                status: 'approved',
            })
            .returning()
        const [post] = await db
            .insert(groupPosts)
            .values({
                groupId: group.id,
                authorId: ids.admin,
                title: '内部帖子',
                content: '成员可见',
                type: 'discussion',
            })
            .returning()
        const target = { targetType: 'group_post' as const, targetId: post.id }
        expect(await canViewTarget(target, { id: ids.student, role: 'student' })).toBe(false)
        const [member] = await db
            .insert(groupMembers)
            .values({ groupId: group.id, userId: ids.student, role: 'member', status: 'pending' })
            .returning()
        expect(await canViewTarget(target, { id: ids.student, role: 'student' })).toBe(false)
        await db.update(groupMembers).set({ status: 'approved' }).where(eq(groupMembers.id, member.id))
        expect(await canViewTarget(target, { id: ids.student, role: 'student' })).toBe(true)
        expect(await canViewTarget(target, undefined)).toBe(false)
        await db.update(groups).set({ isPublic: true }).where(eq(groups.id, group.id))
        expect(await canViewTarget(target, undefined)).toBe(true)
        await db.update(groups).set({ status: 'pending' }).where(eq(groups.id, group.id))
        expect(await canViewTarget(target, undefined)).toBe(false)
    })
})

describe('COEER activities and participant privacy', () => {
    const input = () => ({
        title: '校园活动',
        description: '交流讨论',
        type: 'group' as const,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 90000000),
        maxParticipants: 1,
    })
    it('rejects forged official events and organizer identities', async () => {
        signIn()
        expect((await ActivityService.create({ ...input(), type: 'official' })).success).toBe(false)
        expect(
            (await ActivityService.create({ ...input(), organizerId: ids.other, organizerType: 'user' }))
                .success,
        ).toBe(false)
        expect(await db.select().from(activities)).toHaveLength(0)
    })
    it('enforces capacity, protects rosters and limits check-in to organizers', async () => {
        signIn(ids.admin)
        const activity = await ActivityService.create({ ...input(), type: 'official' })
        expect(activity.success).toBe(true)
        const id = activity.data!.id
        signIn()
        expect((await ActivityService.register({ activityId: id })).success).toBe(true)
        expect(await ActivityService.register({ activityId: id })).toMatchObject({ success: true, state: { code: 'ALREADY_REGISTERED' } })
        expect(
            (await ActivityService.listParticipants({ activityId: id, limit: 10, offset: 0 })).success,
        ).toBe(false)
        const [participant] = await db.select().from(activityParticipants)
        expect((await ActivityService.checkIn({ participantId: participant.id })).success).toBe(false)
        signIn(ids.other)
        expect((await ActivityService.register({ activityId: id })).success).toBe(false)
        signIn(ids.admin)
        expect(
            (await ActivityService.listParticipants({ activityId: id, limit: 10, offset: 0 })).data?.items,
        ).toHaveLength(1)
        expect((await ActivityService.checkIn({ participantId: participant.id })).success).toBe(true)
        expect((await db.select().from(activityParticipants))[0].status).toBe('attended')
    })
})

describe('COEER points and store transactions', () => {
    async function storeItem(stock = 2, pointsCost = 30) {
        return (
            await db
                .insert(redeemItems)
                .values({ name: '学院纪念品', pointsCost, stock, type: 'physical', status: 'active' })
                .returning()
        )[0]
    }
    async function givePoints(amount: number) {
        await db
            .insert(pointTransactions)
            .values({ userId: ids.student, amount, type: 'earn', source: 'adjustment' })
    }
    it('debits points, updates stock and creates a quantity-aware private order', async () => {
        const item = await storeItem()
        await givePoints(100)
        signIn()
        const result = await RedeemService.redeem({ itemId: item.id, quantity: 2 })
        expect(result.success).toBe(true)
        expect(result.data?.quantity).toBe(2)
        expect((await PointService.getBalance()).data?.balance).toBe(40)
        expect((await db.select().from(redeemItems))[0].stock).toBe(0)
        expect(await db.select().from(redeemOrders)).toHaveLength(1)
        signIn(ids.other)
        expect((await RedeemService.getOrder({ orderId: result.data!.id })).success).toBe(false)
        signIn(ids.admin)
        expect((await RedeemService.getOrder({ orderId: result.data!.id })).success).toBe(true)
    })
    it('does not spend points when stock or balance is insufficient', async () => {
        const item = await storeItem(1, 50)
        await givePoints(20)
        signIn()
        expect((await RedeemService.redeem({ itemId: item.id, quantity: 1 })).success).toBe(false)
        expect((await RedeemService.redeem({ itemId: item.id, quantity: 2 })).success).toBe(false)
        expect((await PointService.getBalance()).data?.balance).toBe(20)
        expect((await db.select().from(redeemItems))[0].stock).toBe(1)
        expect(await db.select().from(redeemOrders)).toHaveLength(0)
    })
    it('rolls back the debit and stock update if order creation fails', async () => {
        const item = await storeItem()
        await givePoints(100)
        signIn()
        await db.execute(sql`ALTER TABLE redeem_orders ADD CONSTRAINT reject_test_order CHECK (quantity < 0)`)
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            expect((await RedeemService.redeem({ itemId: item.id, quantity: 1 })).success).toBe(false)
            expect((await PointService.getBalance()).data?.balance).toBe(100)
            expect((await db.select().from(redeemItems))[0].stock).toBe(2)
            expect(await db.select().from(redeemOrders)).toHaveLength(0)
        } finally {
            log.mockRestore()
            await db.execute(sql`ALTER TABLE redeem_orders DROP CONSTRAINT reject_test_order`)
        }
    })
    it('preserves unlimited stock and prevents cross-account point adjustment', async () => {
        const item = await storeItem(-1)
        await givePoints(100)
        signIn()
        expect((await RedeemService.redeem({ itemId: item.id, quantity: 1 })).success).toBe(true)
        expect((await db.select().from(redeemItems))[0].stock).toBe(-1)
        expect(
            (await PointService.earn({ userId: ids.other, amount: 100, source: 'adjustment' })).success,
        ).toBe(false)
        expect((await PointService.getBalance(ids.other)).data?.balance).toBe(70)
    })
})
