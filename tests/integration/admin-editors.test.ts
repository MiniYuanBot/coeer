import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import type { AppSessionData } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData> }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { achievements, cards, feedbacks, redeemItems, users } from '~/database/schemas'
import { FeedbackService } from '~/services/FeedbackService'
import { AchievementService } from '~/services/AchievementService'
import { CardService } from '~/services/CardService'
import { RedeemService } from '~/services/RedeemService'

const admin = '11111111-1111-4111-8111-111111111111'
const student = '22222222-2222-4222-8222-222222222222'
const other = '33333333-3333-4333-8333-333333333333'
const page = { limit: 20, offset: 0 }
function signIn(id = admin) {
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

describe('feedback discovery privacy', () => {
    it('excludes private feedback from public page/feed queries and counts, including for its author and admins', async () => {
        const records = await db.insert(feedbacks).values((['pending', 'processing', 'resolved', 'invalid'] as const).flatMap(status =>
            [true, false].map(isPublic => ({ authorId: student, title: '共享关键词', content: '反馈内容', targetType: 'general' as const, status, isPublic })),
        )).returning()
        for (const viewer of [student, other, admin]) {
            signIn(viewer)
            for (const filter of [{}, { search: '共享关键词' }, { isPublic: false }, { authorId: student }]) {
                const result = await FeedbackService.list({ ...page, ...filter, view: 'public' })
                expect(result.data?.total).toBe(4)
                expect(result.data?.items?.every(item => item.isPublic)).toBe(true)
            }
            const next = await FeedbackService.list({ limit: 1, offset: 4, view: 'public' })
            expect(next.data).toMatchObject({ total: 4, items: [] })
            const filtered = await FeedbackService.list({ ...page, view: 'public', status: 'resolved' })
            expect(filtered.data).toMatchObject({ total: 1, items: [{ isPublic: true, status: 'resolved' }] })
        }
        signIn(student)
        expect((await FeedbackService.list(page)).data?.total).toBe(4)
        expect((await FeedbackService.list({ ...page, view: 'mine' })).data?.total).toBe(8)
        signIn(admin)
        expect((await FeedbackService.list(page)).data?.total).toBe(8)
        expect(records.filter(item => !item.isPublic)).toHaveLength(4)
    })

    it('removes feedback from discovery after a visibility edit without losing its moderation record', async () => {
        const [feedback] = await db.insert(feedbacks).values({ authorId: student, title: '待调整的反馈', content: '内容', targetType: 'general', status: 'resolved', isPublic: true }).returning()
        signIn()
        expect((await FeedbackService.updateStatus({ id: feedback.id, status: feedback.status, isPublic: false })).success).toBe(true)
        for (const viewer of [student, other, admin]) {
            signIn(viewer)
            expect((await FeedbackService.list({ ...page, view: 'public', search: feedback.title })).data).toMatchObject({ total: 0, items: [] })
        }
        expect((await FeedbackService.list(page)).data).toMatchObject({ total: 1, items: [{ id: feedback.id, status: 'resolved', isPublic: false }] })
        signIn(other)
        expect((await FeedbackService.getById({ id: feedback.id })).success).toBe(false)
    })
})

describe('independent admin edit pages', () => {
    it('loads exact records by ID, including sold-out and discontinued items, and requires a platform admin', async () => {
        const [achievement] = await db.insert(achievements).values({ code: 'custom', name: '成就', description: '说明', conditionType: 'login_days', conditionValue: 123 }).returning()
        const [card] = await db.insert(cards).values({ name: '卡片', imageUrl: '/demo/card-rare.svg', rarity: 'rare', dropRate: '0.3' }).returning()
        const [item] = await db.insert(redeemItems).values({ name: '已下架物品', pointsCost: 200, stock: 0, type: 'physical', status: 'discontinued' }).returning()
        const reads = [
            () => AchievementService.adminGet({ achievementId: achievement.id }),
            () => CardService.adminGet({ cardId: card.id }),
            () => RedeemService.adminGetItem({ itemId: item.id }),
        ]
        for (const read of reads) expect((await read()).state.code).toBe('UNAUTHORIZED')
        signIn(student)
        for (const read of reads) expect((await read()).state.code).toBe('FORBIDDEN')
        signIn()
        expect((await reads[0]()).data).toMatchObject({ id: achievement.id, conditionValue: 123 })
        expect((await reads[1]()).data).toMatchObject({ id: card.id, imageUrl: card.imageUrl })
        expect((await reads[2]()).data).toMatchObject({ id: item.id, status: 'discontinued', stock: 0 })
        expect((await AchievementService.adminGet({ achievementId: randomUUID() })).success).toBe(false)
        expect((await CardService.adminGet({ cardId: randomUUID() })).success).toBe(false)
        expect((await RedeemService.adminGetItem({ itemId: randomUUID() })).success).toBe(false)
    })
})
