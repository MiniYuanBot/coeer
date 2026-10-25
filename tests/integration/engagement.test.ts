import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData>, clear: vi.fn() }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { achievements, activityParticipants, activities, cards, feedbacks, feedbackStatusLogs, groups, groupMembers, groupPosts, pointTransactions, replies, userAchievements, userCards, users } from '~/database/schemas'
import { AchievementService } from '~/services/AchievementService'
import { CardService } from '~/services/CardService'
import { EngagementService } from '~/services/EngagementService'
import { FeedbackService } from '~/services/FeedbackService'
import { GroupService } from '~/services/GroupService'
import { GroupPostService } from '~/services/GroupPostService'
import { ReplyService } from '~/services/ReplyService'
import { ActivityService } from '~/services/ActivityService'
import { PointService } from '~/services/PointService'
import { achievementQueries } from '~/database/queries/achievements'
import { GROUP_CATEGORY_ARRAY, FEEDBACK_TARGET_TYPE_ARRAY } from '@shared/constants'
import { engagementDay } from '@shared/constants/engagement'

const student = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const admin = '33333333-3333-4333-8333-333333333333'
const page = { limit: 10, offset: 0 }
function signIn(id = student) {
    session.data = { id, passwordVersion: createHash('sha256').update('test-password-hash').digest('hex') }
}
beforeAll(initializeDatabase)
beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
    session.data = {}
    await db.insert(users).values([student, other, admin].map((id) => ({
        id, email: `${id}@example.test`, passwordHash: 'test-password-hash', role: id === admin ? 'admin' as const : 'student' as const,
    })))
})
afterAll(() => client.close())

async function definitions() {
    await db.insert(achievements).values([
        { code: 'FIRST_FEEDBACK', name: '初次发声', description: '提交第一条反馈', conditionType: 'action', conditionValue: 1 },
        { code: 'GROUP_STARTER', name: '社群发起人', description: '创建或管理一个群组', conditionType: 'action', conditionValue: 1 },
        { code: 'CARD_COLLECTOR', name: '卡片收藏家', description: '收集三种卡片', conditionType: 'count', conditionValue: 3 },
    ])
}
async function discussion() {
    const [group] = await db.insert(groups).values({ name: '讨论组', slug: 'discussion', category: GROUP_CATEGORY_ARRAY[0], status: 'approved', creatorId: admin }).returning()
    await db.insert(groupMembers).values({ userId: student, groupId: group.id, role: 'member', status: 'approved' })
    const [post] = await db.insert(groupPosts).values({ groupId: group.id, authorId: admin, title: '主题', content: '正文' }).returning()
    return { group, post }
}

describe('filtered pagination and feedback privacy', () => {
    it('uses the same public-only scope for rows and totals, including the author and platform admin', async () => {
        const targetType = FEEDBACK_TARGET_TYPE_ARRAY[0]
        await db.insert(feedbacks).values([
            { title: '公共问题甲', content: '内容', authorId: other, targetType, isPublic: true },
            { title: '公共问题乙', content: '内容', authorId: student, targetType, isPublic: true },
            { title: '公共问题私密甲', content: '内容', authorId: student, targetType, isPublic: false },
            { title: '公共问题私密乙', content: '内容', authorId: other, targetType, isPublic: false },
            { title: '其他关键词', content: '内容', authorId: other, targetType, isPublic: true },
        ])
        for (const viewer of [student, admin]) {
            signIn(viewer)
            const query = { view: 'public' as const, targetType, search: '公共问题', limit: 1 }
            const first = (await FeedbackService.list({ ...query, offset: 0 })).data!
            const second = (await FeedbackService.list({ ...query, offset: 1 })).data!
            const last = (await FeedbackService.list({ ...query, offset: 2 })).data!
            expect(first.total).toBe(2)
            expect(second.total).toBe(2)
            expect(first.items![0].isPublic).toBe(true)
            expect(second.items![0].isPublic).toBe(true)
            expect(first.items![0].id).not.toBe(second.items![0].id)
            expect(last.items).toHaveLength(0)
        }
        signIn()
        expect((await FeedbackService.list({ ...page, view: 'mine' })).data?.total).toBe(2)
        signIn(admin)
        expect((await FeedbackService.list(page)).data?.total).toBe(5)
    })

    it('filters owned cards and memberships before slicing pages, beyond the old 100-row cutoff', async () => {
        signIn()
        const pool = await db.insert(cards).values(Array.from({ length: 105 }, (_, index) => ({
            name: `卡片 ${String(index).padStart(3, '0')}`, rarity: index < 103 ? 'common' as const : 'rare' as const, imageUrl: '/test.svg', dropRate: '1.0000',
        }))).returning()
        await db.insert(userCards).values(pool.map((card) => ({ userId: student, cardId: card.id })))
        const first = (await CardService.listMine({ rarity: 'rare', limit: 1, offset: 0 })).data!
        const second = (await CardService.listMine({ rarity: 'rare', limit: 1, offset: 1 })).data!
        expect(first.total).toBe(2)
        expect(second.total).toBe(2)
        expect(first.items![0].id).not.toBe(second.items![0].id)
        expect((await CardService.listMine({ ...page, search: '104' })).data?.total).toBe(1)
        const memberships = await db.insert(groups).values(Array.from({ length: 105 }, (_, index) => ({
            name: `群组 ${index}`, slug: `group-${index}`, category: GROUP_CATEGORY_ARRAY[0], status: 'approved' as const,
        }))).returning()
        await db.insert(groupMembers).values(memberships.map((group) => ({ userId: student, groupId: group.id, status: 'approved' as const })))
        const result = (await GroupService.listMyGroups({ ...page, search: 'group-104' })).data!
        expect(result.total).toBe(1)
        expect(result.items![0].group.slug).toBe('group-104')
        const ledger = await db.insert(pointTransactions).values(Array.from({ length: 12 }, () => ({ userId: student, source: 'adjustment' as const, type: 'earn' as const, amount: 1 }))).returning()
        const history = (await PointService.getHistory({ limit: 8, offset: 8 })).data!
        expect(history.total).toBe(ledger.length)
        expect(history.items).toHaveLength(4)
    })
})

describe('automatic achievements', () => {
    it('serializes reconciliation with simultaneous feedback and group writes', async () => {
        await definitions()
        signIn()
        const [feedback, group] = await Promise.all([
            FeedbackService.create({ title: '并发反馈', content: '内容', targetType: FEEDBACK_TARGET_TYPE_ARRAY[0], isAnonymous: false }),
            GroupService.create({ name: '并发群组', slug: 'concurrent', category: GROUP_CATEGORY_ARRAY[0], isPublic: true }),
            ...Array.from({ length: 4 }, () => AchievementService.listMine(page)),
        ])
        expect(feedback.success).toBe(true)
        expect(group.success).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(2)
    })

    it('backfills historical qualifications, counts distinct positive card ownership, and is concurrency-safe', async () => {
        await definitions()
        await db.insert(feedbacks).values({ authorId: student, title: '历史反馈', content: '内容', targetType: FEEDBACK_TARGET_TYPE_ARRAY[0] })
        const [group] = await db.insert(groups).values({ name: '群组', slug: 'managed', category: GROUP_CATEGORY_ARRAY[0], status: 'approved', creatorId: other }).returning()
        await db.insert(groupMembers).values({ userId: student, groupId: group.id, role: 'admin', status: 'approved' })
        const pool = await db.insert(cards).values(Array.from({ length: 3 }, (_, index) => ({ name: `卡 ${index}`, rarity: 'common' as const, imageUrl: '/test.svg', dropRate: '1.0000' }))).returning()
        await db.insert(userCards).values(pool.map((card, index) => ({ userId: student, cardId: card.id, count: index === 0 ? 10 : index === 2 ? 0 : 1 })))
        signIn()
        await Promise.all(Array.from({ length: 3 }, () => AchievementService.listMine(page)))
        expect(await db.select().from(userAchievements)).toHaveLength(2)
        let progress = (await AchievementService.list(page)).data!.items!.find((item) => item.code === 'CARD_COLLECTOR')!
        expect(progress.unlocked).toBe(false)
        expect(progress.progress).toMatchObject({ current: 2, target: 3 })
        await db.update(userCards).set({ count: 1 }).where(eq(userCards.cardId, pool[2].id))
        progress = (await AchievementService.list(page)).data!.items!.find((item) => item.code === 'CARD_COLLECTOR')!
        expect(progress.unlocked).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(3)
        signIn(other)
        expect((await AchievementService.listMine(page)).data?.items?.map((item) => item.achievement.code)).toEqual(['GROUP_STARTER'])
    })

    it('unlocks immediately for feedback, group creation and a qualifying draw', async () => {
        await definitions()
        signIn()
        expect((await FeedbackService.create({ title: '反馈', content: '内容', targetType: FEEDBACK_TARGET_TYPE_ARRAY[0], isAnonymous: false })).success).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(1)
        expect((await GroupService.create({ name: '新群组', slug: 'new-group', category: GROUP_CATEGORY_ARRAY[0], isPublic: true })).success).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(2)
        const [card] = await db.insert(cards).values({ name: '首张卡片', rarity: 'common', imageUrl: '/test.svg', dropRate: '1.0000' }).returning()
        await db.update(achievements).set({ conditionValue: 1 }).where(eq(achievements.code, 'CARD_COLLECTOR'))
        await db.insert(pointTransactions).values({ userId: student, source: 'adjustment', type: 'earn', amount: 100 })
        expect((await CardService.draw({ count: 1 })).success).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(3)
        expect((await db.select().from(userCards))[0].cardId).toBe(card.id)
    })
})

describe('engagement rewards', () => {
    it('caps concurrent rewards, isolates users and uses the Beijing day boundary', async () => {
        const now = new Date('2026-10-22T15:59:59Z')
        expect(engagementDay(now).day).toBe('2026-10-22')
        const nextDay = new Date('2026-10-22T16:00:00Z')
        expect(engagementDay(nextDay).day).toBe('2026-10-23')
        const record = (userId: string, event: string, date: Date) => db.transaction((tx) => EngagementService.recordInTx(userId, 'post', event, tx, date))
        await Promise.all(Array.from({ length: 8 }, () => record(student, randomUUID(), now)))
        expect(await db.select().from(pointTransactions)).toHaveLength(3)
        await record(other, 'other-post', now)
        await record(student, 'tomorrow-post', nextDay)
        await record(student, 'tomorrow-post', new Date('2026-10-24T00:00:00Z'))
        expect(await db.select().from(pointTransactions)).toHaveLength(5)
        await Promise.all(Array.from({ length: 5 }, () => EngagementService.recordDailyVisit(student)))
        expect((await db.select().from(pointTransactions)).filter((item) => item.source === 'daily_login')).toHaveLength(1)
    })

    it('rewards only successful posts and replies, with separate caps, and attendance only once', async () => {
        const { group, post } = await discussion()
        signIn(other)
        expect((await GroupPostService.create({ groupId: group.id, title: '无权限', content: '内容', type: 'discussion' })).success).toBe(false)
        expect(await db.select().from(pointTransactions)).toHaveLength(0)
        signIn()
        const posted = await Promise.all(Array.from({ length: 5 }, (_, index) => GroupPostService.create({ groupId: group.id, title: `帖子 ${index}`, content: '内容', type: 'discussion' })))
        expect(posted.every((result) => result.success)).toBe(true)
        const answered = await Promise.all(Array.from({ length: 7 }, (_, index) => ReplyService.create({ targetType: 'group_post', targetId: post.id, content: `回复 ${index}` })))
        expect(answered.every((result) => result.success)).toBe(true)
        expect((await PointService.getBalance()).data?.balance).toBe(25)
        const [activity] = await db.insert(activities).values({ title: '活动', description: '内容', type: 'official', organizerType: 'user', organizerId: admin, startTime: new Date(), endTime: new Date(Date.now() + 3600000) }).returning()
        const [participant] = await db.insert(activityParticipants).values({ activityId: activity.id, userId: student }).returning()
        expect((await ActivityService.checkIn({ participantId: participant.id })).success).toBe(false)
        signIn(admin)
        await Promise.all(Array.from({ length: 3 }, () => ActivityService.checkIn({ participantId: participant.id })))
        const attendance = (await db.select().from(pointTransactions)).filter((item) => item.source === 'activity')
        expect(attendance).toHaveLength(1)
        expect(attendance[0]).toMatchObject({ userId: student, amount: 20 })
    })

    it('rolls back the action, reward and achievement together on a persistence failure', async () => {
        await definitions()
        signIn()
        vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.spyOn(achievementQueries, 'unlockMany').mockRejectedValueOnce(new Error('database failure'))
        expect((await FeedbackService.create({ title: '回滚', content: '内容', targetType: FEEDBACK_TARGET_TYPE_ARRAY[0], isAnonymous: false })).success).toBe(false)
        expect(await db.select().from(feedbacks)).toHaveLength(0)
        expect(await db.select().from(feedbackStatusLogs)).toHaveLength(0)
        expect(await db.select().from(pointTransactions)).toHaveLength(0)
        expect(await db.select().from(userAchievements)).toHaveLength(0)
    })
})
