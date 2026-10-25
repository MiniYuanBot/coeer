import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'
import { GROUP_CATEGORY_ARRAY } from '@shared/constants'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData> }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { achievements, activities, activityParticipants, bulletins, cards, groups, redeemItems, redeemOrders, userAchievements, userCards, users } from '~/database/schemas'
import { AchievementService } from '~/services/AchievementService'
import { CardService } from '~/services/CardService'
import { ActivityService } from '~/services/ActivityService'
import { BulletinService } from '~/services/BulletinService'
import { RedeemService } from '~/services/RedeemService'
import { GroupService } from '~/services/GroupService'
import { cardQueries } from '~/database/queries/cards'

const admin = '11111111-1111-4111-8111-111111111111'
const student = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const page = { limit: 20, offset: 0 }
function signIn(id = student) {
    session.data = { id, passwordVersion: createHash('sha256').update('review-hash').digest('hex') }
}
beforeAll(initializeDatabase)
beforeEach(async () => {
    await resetDatabase()
    session.data = {}
    await db.insert(users).values([
        { id: admin, email: 'admin@example.test', role: 'admin', passwordHash: 'review-hash' },
        { id: student, email: 'student@example.test', role: 'student', passwordHash: 'review-hash' },
        { id: other, email: 'other@example.test', role: 'student', passwordHash: 'review-hash' },
    ])
})
afterAll(() => client.close())

describe('collection visibility', () => {
    it('reveals hidden achievements only after unlocking and excludes their metadata from search, counts and pagination', async () => {
        const [hidden, visible] = await db.insert(achievements).values([
            { code: 'a-secret', name: '隐藏成就', description: '秘密说明', conditionType: 'login_days' as const, conditionValue: 100, isHidden: true },
            { code: 'z-public', name: '公开成就', description: '公开说明', conditionType: 'login_days' as const, conditionValue: 100, isHidden: false },
        ]).returning()
        for (const viewer of [null, student, other, admin]) {
            if (viewer) signIn(viewer)
            else session.data = {}
            expect((await AchievementService.list({ limit: 1, offset: 0 })).data).toMatchObject({ total: 1, items: [{ id: visible.id, unlocked: false }] })
            expect((await AchievementService.list({ limit: 1, offset: 1 })).data).toMatchObject({ total: 1, items: [] })
            for (const search of [hidden.name, hidden.description, hidden.code]) {
                expect((await AchievementService.list({ ...page, search })).data).toMatchObject({ total: 0, items: [] })
            }
            expect((await AchievementService.list({ ...page, isHidden: true })).data).toMatchObject({ total: 0, items: [] })
        }
        await db.insert(userAchievements).values({ userId: student, achievementId: hidden.id })
        signIn()
        expect((await AchievementService.list({ ...page, isHidden: true })).data).toMatchObject({ total: 1, items: [{ id: hidden.id, unlocked: true }] })
        signIn(other)
        expect((await AchievementService.list(page)).data?.total).toBe(1)
        expect((await AchievementService.adminList(page)).state.code).toBe('FORBIDDEN')
        signIn(admin)
        expect((await AchievementService.adminList(page)).data?.total).toBe(2)
        expect((await AchievementService.adminList({ ...page, isHidden: true, conditionType: 'login_days' })).data).toMatchObject({ total: 1, items: [{ id: hidden.id }] })
    })

    it('reveals hidden cards only to owners with positive quantities while preserving hidden draw eligibility', async () => {
        const [hidden, visible] = await db.insert(cards).values([
            { name: 'A隐藏卡片', description: '秘密卡面', imageUrl: '/demo/card-rare.svg', rarity: 'rare' as const, dropRate: '1', isHidden: true },
            { name: 'Z公开卡片', imageUrl: '/demo/card-common.svg', rarity: 'common' as const, dropRate: '0', isHidden: false },
        ]).returning()
        await db.insert(userCards).values({ userId: student, cardId: hidden.id, count: 0 })
        for (const viewer of [null, student, other, admin]) {
            if (viewer) signIn(viewer)
            else session.data = {}
            expect((await CardService.listCards({ limit: 1, offset: 0 })).data).toMatchObject({ total: 1, items: [{ id: visible.id, ownedCount: 0 }] })
            expect((await CardService.listCards({ limit: 1, offset: 1 })).data).toMatchObject({ total: 1, items: [] })
            expect((await CardService.listCards({ ...page, search: hidden.name })).data).toMatchObject({ total: 0, items: [] })
            expect((await CardService.listCards({ ...page, isHidden: true, rarity: 'rare' })).data).toMatchObject({ total: 0, items: [] })
        }
        expect((await cardQueries.listPool()).map(card => card.id)).toEqual([hidden.id])
        await db.update(userCards).set({ count: 2 }).where(eq(userCards.userId, student))
        signIn()
        expect((await CardService.listCards({ ...page, isHidden: true })).data).toMatchObject({ total: 1, items: [{ id: hidden.id, ownedCount: 2 }] })
        expect((await CardService.listMine(page)).data?.items?.[0].card.id).toBe(hidden.id)
        signIn(other)
        expect((await CardService.listCards(page)).data?.total).toBe(1)
        expect((await CardService.adminList(page)).state.code).toBe('FORBIDDEN')
        signIn(admin)
        expect((await CardService.adminList({ ...page, isHidden: true, rarity: 'rare' })).data).toMatchObject({ total: 1, items: [{ id: hidden.id }] })
    })

    it('preserves and edits visibility through the administrator creation and update flows', async () => {
        signIn(admin)
        const created = (await AchievementService.adminCreate({ code: 'secret', name: '隐藏成就', description: '说明', conditionType: 'login_days', conditionValue: 100, isHidden: true })).data!
        const card = (await CardService.adminCreate({ name: '隐藏卡片', imageUrl: '/demo/card-rare.svg', rarity: 'rare', dropRate: 1, isHidden: true })).data!
        expect((await AchievementService.adminGet({ achievementId: created.id })).data?.isHidden).toBe(true)
        expect((await CardService.adminGet({ cardId: card.id })).data?.isHidden).toBe(true)
        await AchievementService.adminUpdate({ achievementId: created.id, isHidden: false })
        await CardService.adminUpdate({ cardId: card.id, isHidden: false })
        session.data = {}
        expect((await AchievementService.list(page)).data?.total).toBe(1)
        expect((await CardService.listCards(page)).data?.total).toBe(1)
    })
})

describe('management filters and application state', () => {
    it('counts bulletin type and pin filters before pagination', async () => {
        await db.insert(bulletins).values([
            { title: '置顶公告', content: '内容', type: 'official', isPinned: true },
            { title: '普通公告', content: '内容', type: 'official', isPinned: false },
            { title: '群组公告', content: '内容', type: 'group_announcement', isPinned: true },
        ])
        expect((await BulletinService.list({ ...page, type: 'official', isPinned: true })).data).toMatchObject({ total: 1, items: [{ title: '置顶公告' }] })
        expect((await BulletinService.list({ limit: 1, offset: 1, type: 'official', isPinned: true })).data).toMatchObject({ total: 1, items: [] })
    })

    it('filters the protected registration and order scopes consistently with their totals', async () => {
        const activityRows = await db.insert(activities).values((['official', 'group'] as const).map(type => ({ title: type, description: '说明', type, organizerType: 'user' as const, organizerId: admin, startTime: new Date('2027-01-01'), endTime: new Date('2027-01-02') }))).returning()
        await db.insert(activityParticipants).values(activityRows.map(activity => ({ activityId: activity.id, userId: student })))
        const items = await db.insert(redeemItems).values((['physical', 'virtual'] as const).map(type => ({ name: type, pointsCost: 10, type }))).returning()
        await db.insert(redeemOrders).values(items.map(item => ({ itemId: item.id, userId: student })))
        expect((await ActivityService.adminListParticipants(page)).state.code).toBe('UNAUTHORIZED')
        expect((await RedeemService.adminListOrders(page)).state.code).toBe('UNAUTHORIZED')
        signIn()
        expect((await ActivityService.adminListParticipants(page)).state.code).toBe('FORBIDDEN')
        expect((await RedeemService.adminListOrders(page)).state.code).toBe('FORBIDDEN')
        signIn(admin)
        expect((await ActivityService.adminListParticipants({ ...page, type: 'official', search: 'official' })).data).toMatchObject({ total: 1, items: [{ activity: { type: 'official' }, user: { id: student } }] })
        expect((await ActivityService.adminListParticipants({ limit: 1, offset: 1, type: 'official' })).data).toMatchObject({ total: 1, items: [] })
        expect((await RedeemService.adminListItems({ ...page, type: 'physical' })).data?.total).toBe(1)
        expect((await RedeemService.adminListOrders({ ...page, type: 'virtual', search: 'virtual' })).data).toMatchObject({ total: 1, items: [{ item: { type: 'virtual' }, user: { id: student } }] })
        expect((await RedeemService.adminListOrders({ limit: 1, offset: 1, type: 'virtual' })).data).toMatchObject({ total: 1, items: [] })
    })

    it('reads the signed-in user application status without granting membership or exposing another user application', async () => {
        const [group] = await db.insert(groups).values({ name: '私密群组', slug: 'pending-application', category: GROUP_CATEGORY_ARRAY[0], status: 'approved', isPublic: false }).returning()
        expect((await GroupService.getMyMembership({ groupId: group.id })).state.code).toBe('UNAUTHORIZED')
        signIn()
        expect((await GroupService.getMyMembership({ groupId: group.id })).data).toBeNull()
        await GroupService.joinGroup({ groupId: group.id })
        expect((await GroupService.getMyMembership({ groupId: group.id })).data).toMatchObject({ userId: student, status: 'pending' })
        signIn(other)
        expect((await GroupService.getMyMembership({ groupId: group.id })).data).toBeNull()
    })
})
