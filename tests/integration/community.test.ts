import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { SessionUser } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<SessionUser>, update: vi.fn(), clear: vi.fn() }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { AuthService } from '~/services/AuthService'
import { ActivityService } from '~/services/ActivityService'
import { FeedbackService } from '~/services/FeedbackService'
import { PointService } from '~/services/PointService'
import { RedeemService } from '~/services/RedeemService'
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
} from '~/database/schemas'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'

const ids = {
    student: '11111111-1111-4111-8111-111111111111',
    other: '22222222-2222-4222-8222-222222222222',
    admin: '33333333-3333-4333-8333-333333333333',
}
let passwordHash: string
function signIn(id: string = ids.student) {
    session.data = { id }
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
    await resetDatabase()
    vi.clearAllMocks()
    session.data = {}
    await db.insert(users).values([
        { id: ids.student, email: 'student@example.test', name: '学生', passwordHash, role: 'student' },
        { id: ids.other, email: 'other@example.test', name: '其他学生', passwordHash, role: 'student' },
        { id: ids.admin, email: 'admin@example.test', name: '管理员', passwordHash, role: 'admin' },
    ])
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
        session.data = { id: ids.student, role: 'admin' }
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
            (await AuthService.signup({ email: 'new@example.test', password: 'new-password-2026' })).success,
        ).toBe(true)
        expect(session.data.role).toBe('student')
        const id = session.data.id
        await AuthService.logout()
        expect(
            (await AuthService.signup({ email: 'new@example.test', password: 'wrong-password' })).success,
        ).toBe(false)
        expect(session.data.id).toBeUndefined()
        expect(
            (await AuthService.login({ email: 'new@example.test', password: 'new-password-2026' })).success,
        ).toBe(true)
        expect(session.data.id).toBe(id)
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
        expect((await ActivityService.register({ activityId: id })).success).toBe(false)
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
        await client.exec('ALTER TABLE redeem_orders ADD CONSTRAINT reject_test_order CHECK (quantity < 0)')
        const log = vi.spyOn(console, 'error').mockImplementation(() => {})
        try {
            expect((await RedeemService.redeem({ itemId: item.id, quantity: 1 })).success).toBe(false)
            expect((await PointService.getBalance()).data?.balance).toBe(100)
            expect((await db.select().from(redeemItems))[0].stock).toBe(2)
            expect(await db.select().from(redeemOrders)).toHaveLength(0)
        } finally {
            log.mockRestore()
            await client.exec('ALTER TABLE redeem_orders DROP CONSTRAINT reject_test_order')
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
