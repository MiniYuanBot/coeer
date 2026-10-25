import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, randomUUID } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import type { AppSessionData } from '@shared/contracts/auth'

const session = vi.hoisted(() => ({ data: {} as Partial<AppSessionData>, clear: vi.fn(), update: vi.fn() }))
vi.mock('~/utils/session', () => ({ useAppSession: async () => session }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { achievements, cards, feedbacks, pointTransactions, uploadedImages, userAchievements, userCards, users } from '~/database/schemas'
import { AchievementService } from '~/services/AchievementService'
import { AuthService } from '~/services/AuthService'
import { EngagementService } from '~/services/EngagementService'
import { PointService } from '~/services/PointService'
import { RedeemService } from '~/services/RedeemService'
import { readImage, uploadImage } from '~/services/ImageService'
import { CreateAchievementSchema, UpdateAchievementSchema } from '@shared/contracts/achievements'
import { CreateRedeemItemSchema, UpdateRedeemItemSchema } from '@shared/contracts/redeems'
import { MAX_IMAGE_BYTES } from '@shared/images'
import { engagementDay } from '@shared/constants/engagement'
import { env } from '~/config'
import { CardService } from '~/services/CardService'
import { CreateCardSchema } from '@shared/contracts/cards'
import { cardQueries } from '~/database/queries/cards'

const admin = '11111111-1111-4111-8111-111111111111'
const student = '22222222-2222-4222-8222-222222222222'
const page = { limit: 50, offset: 0 }
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
let passwordHash: string
function signIn(id = admin) { session.data = { id, passwordVersion: createHash('sha256').update(passwordHash).digest('hex') } }
const definition = (code: string, conditionType: 'registration' | 'login_days' | 'points_earned' | 'feedback_count', conditionValue: number) => ({
    code, name: code, description: '自定义成就', conditionType, conditionValue,
})
function upload(bytes: Buffer = png, mime = 'image/png', headers: Record<string, string> = {}) {
    return uploadImage(new Request('http://localhost/api/images/', { method: 'POST', headers: { 'Content-Type': mime, ...headers }, body: new Uint8Array(bytes).buffer }))
}
beforeAll(async () => { await initializeDatabase(); passwordHash = await bcrypt.hash('test-password', 4) })
beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
    session.data = {}
    session.update.mockImplementation(async (data: AppSessionData) => { session.data = data })
    await db.insert(users).values([
        { id: admin, email: 'admin@example.test', passwordHash, role: 'admin' },
        { id: student, email: '0000000001@stu.pku.edu.cn', passwordHash, role: 'student' },
    ])
})
afterAll(() => client.close())

describe('card administration and drawable pool', () => {
    const input = { name: '校园纪念卡', imageUrl: '/demo/card-common.svg', rarity: 'common' as const, series: '校园', dropRate: .1 }
    it('allows only administrators to delete unowned cards and preserves existing collections', async () => {
        signIn()
        const unused = (await CardService.adminCreate(input)).data!
        const owned = (await CardService.adminCreate({ ...input, name: '已收藏卡片' })).data!
        await db.insert(userCards).values({ userId: student, cardId: owned.id, count: 2 })
        session.data = {}
        expect((await CardService.adminDelete({ cardId: unused.id })).state.code).toBe('UNAUTHORIZED')
        signIn(student)
        expect((await CardService.adminDelete({ cardId: unused.id })).state.code).toBe('FORBIDDEN')
        signIn()
        expect((await CardService.adminDelete({ cardId: 'invalid' })).state.code).toBe('INVALID_INPUT')
        expect((await CardService.adminDelete({ cardId: unused.id })).state.code).toBe('DELETE_SUCCESS')
        expect(await cardQueries.findById(unused.id)).toBeUndefined()
        expect((await CardService.adminDelete({ cardId: unused.id })).state.code).toBe('CARD_NOT_FOUND')
        expect((await CardService.adminDelete({ cardId: owned.id })).state.code).toBe('CARD_IN_USE')
        expect(await cardQueries.findById(owned.id)).toBeDefined()
        expect(await db.select().from(userCards)).toMatchObject([{ cardId: owned.id, count: 2 }])
        expect((await cardQueries.listPool()).map(card => card.id)).toEqual([owned.id])
    })

    it('authorizes card changes and validates uploaded URLs and decimal weights', async () => {
        expect((await CardService.adminCreate(input)).state.code).toBe('UNAUTHORIZED')
        signIn(student)
        expect((await CardService.adminCreate(input)).state.code).toBe('FORBIDDEN')
        signIn()
        const { url } = await (await upload()).json()
        const created = (await CardService.adminCreate(CreateCardSchema.parse({ ...input, imageUrl: url }))).data!
        expect(created).toMatchObject({ imageUrl: url, dropRate: '0.1000' })
        signIn(student)
        expect((await CardService.adminUpdate({ cardId: created.id, name: '未经授权的修改' })).state.code).toBe('FORBIDDEN')
        signIn()
        expect((await CardService.adminUpdate({ cardId: created.id, rarity: 'legendary', dropRate: .0001 })).data).toMatchObject({ rarity: 'legendary', dropRate: '0.0001' })
        for (const dropRate of [-1, 1.1, .00001]) expect((await CardService.adminCreate({ ...input, dropRate })).state.code).toBe('INVALID_INPUT')
        expect((await CardService.adminUpdate({ cardId: created.id, imageUrl: 'javascript:alert(1)' })).state.code).toBe('INVALID_INPUT')
        expect((await CardService.adminUpdate({ cardId: randomUUID(), dropRate: .1 })).state.code).toBe('CARD_NOT_FOUND')
    })

    it('draws newly added cards, excludes zero weights, and keeps ownership after removing a card from the pool', async () => {
        signIn()
        const active = (await CardService.adminCreate(input)).data!
        await CardService.adminCreate({ ...input, name: '暂不开放的卡片', dropRate: 0 })
        await db.insert(pointTransactions).values({ userId: student, amount: 200, type: 'earn', source: 'adjustment' })
        signIn(student)
        vi.spyOn(Math, 'random').mockReturnValue(0)
        const draw = (await CardService.draw({ count: 2 })).data!
        expect(draw.pointsSpent).toBe(100)
        expect(draw.cards.map((item) => item.card.id)).toEqual([active.id, active.id])
        expect((await PointService.getBalance()).data?.balance).toBe(100)
        signIn()
        expect((await CardService.adminUpdate({ cardId: active.id, dropRate: 0, description: '保留已有收藏' })).success).toBe(true)
        signIn(student)
        expect((await CardService.draw({ count: 1 })).state.code).toBe('EMPTY_POOL')
        expect((await PointService.getBalance()).data?.balance).toBe(100)
        expect((await CardService.listMine(page)).data).toMatchObject({ total: 1, items: [{ count: 2, card: { id: active.id, description: '保留已有收藏' } }] })
        expect(await db.select().from(userCards)).toHaveLength(1)
    })

    it('normalizes relative weights rather than treating each weight as an independent percentage', async () => {
        const pool = await db.insert(cards).values([
            { ...input, id: '10000000-0000-4000-8000-000000000001', name: '普通', dropRate: '0.6000' },
            { ...input, id: '10000000-0000-4000-8000-000000000002', name: '稀有', dropRate: '0.3000' },
            { ...input, id: '10000000-0000-4000-8000-000000000003', name: '传说', dropRate: '0.1000' },
        ]).returning()
        await db.insert(pointTransactions).values({ userId: student, amount: 150, type: 'earn', source: 'adjustment' })
        signIn(student)
        vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(.7).mockReturnValueOnce(.99)
        const result = (await CardService.draw({ count: 3 })).data!
        expect(result.cards.map((item) => item.card.id)).toEqual(pool.map((item) => item.id))
        expect((await PointService.getBalance()).data?.balance).toBe(0)
    })

    it('rolls back the charge when ownership cannot be persisted', async () => {
        signIn()
        await CardService.adminCreate(input)
        await db.insert(pointTransactions).values({ userId: student, amount: 50, type: 'earn', source: 'adjustment' })
        signIn(student)
        vi.spyOn(cardQueries, 'upsertUserCard').mockRejectedValueOnce(new Error('card write failed'))
        vi.spyOn(console, 'error').mockImplementation(() => {})
        expect((await CardService.draw({ count: 1 })).state.code).toBe('SERVER_ERROR')
        expect((await PointService.getBalance()).data?.balance).toBe(50)
        expect(await db.select().from(userCards)).toHaveLength(0)
    })
})

describe('configurable achievement rules', () => {
    it('awards any registration rule immediately during signup, and logs in once per Beijing date', async () => {
        signIn()
        expect((await AchievementService.adminCreate(definition('任意欢迎代码', 'registration', 1))).success).toBe(true)
        session.data = {}
        expect((await AuthService.signup({ email: '0000000002@stu.pku.edu.cn', password: 'test-password' })).success).toBe(true)
        const id = session.data.id!
        expect(await db.select().from(userAchievements)).toMatchObject([{ userId: id }])
        expect((await AuthService.login({ email: '0000000002@stu.pku.edu.cn', password: 'test-password' })).success).toBe(true)
        await EngagementService.recordDailyVisit(id)
        expect(await db.select().from(userAchievements)).toHaveLength(1)
        expect(await db.select().from(pointTransactions)).toHaveLength(1)
        signIn(student)
        expect((await AchievementService.listMine(page)).data?.total).toBe(1)
    })

    it('counts 100 nonconsecutive login dates, deduplicates dates across UTC midnight and unlocks at the Beijing boundary', async () => {
        signIn()
        await AchievementService.adminCreate(definition('hundred-days-custom', 'login_days', 100))
        const start = new Date('2025-01-01T16:00:00Z').getTime()
        const dates = Array.from({ length: 99 }, (_, index) => new Date(start + index * 2 * 86400000))
        await db.insert(pointTransactions).values(dates.map((createdAt) => ({ userId: student, source: 'daily_login' as const, type: 'earn' as const, amount: 5, createdAt })))
        // These two UTC dates are both the 99th login date in Beijing.
        await db.insert(pointTransactions).values({ userId: student, source: 'daily_login', type: 'earn', amount: 5, createdAt: new Date(dates[98].getTime() + 9 * 3600000) })
        signIn(student)
        const at99 = (await AchievementService.list(page)).data!.items![0]
        expect(at99).toMatchObject({ unlocked: false, progress: { current: 99, target: 100, percentage: 99 } })
        const record = (now: Date) => db.transaction((tx) => EngagementService.recordInTx(student, 'daily', engagementDay(now).day, tx, now))
        await record(new Date(dates[98].getTime() + 86400000 - 1))
        expect(await db.select().from(userAchievements)).toHaveLength(0)
        await Promise.all(Array.from({ length: 3 }, () => record(new Date(dates[98].getTime() + 86400000))))
        expect(await db.select().from(userAchievements)).toHaveLength(1)
        expect((await AchievementService.list(page)).data!.items![0]).toMatchObject({ unlocked: true, progress: { current: 100, percentage: 100 } })
    })

    it('sums lifetime positive earnings, keeps progress after spending, and supports multiple rules with arbitrary codes', async () => {
        signIn()
        await AchievementService.adminCreate(definition('ten-thousand-custom', 'points_earned', 10000))
        await AchievementService.adminCreate(definition('fifteen-thousand-custom', 'points_earned', 15000))
        await db.insert(pointTransactions).values({ userId: student, type: 'earn', source: 'adjustment', amount: 9999 })
        signIn(student)
        expect((await AchievementService.listMine(page)).data?.total).toBe(0)
        expect((await PointService.earn({ userId: student, source: 'activity', amount: 1 })).success).toBe(true)
        expect(await db.select().from(userAchievements)).toHaveLength(1)
        expect((await PointService.spend({ userId: student, source: 'redeem', amount: 9000 })).success).toBe(true)
        const progress = (await AchievementService.list(page)).data!.items!
        expect(progress.find((item) => item.code === 'ten-thousand-custom')).toMatchObject({ unlocked: true, progress: { current: 10000, percentage: 100 } })
        expect(progress.find((item) => item.code === 'fifteen-thousand-custom')).toMatchObject({ unlocked: false, progress: { current: 10000, target: 15000 } })
        expect((await PointService.getBalance()).data?.balance).toBe(1000)
    })

    it('backfills new custom rules from persisted feedback and respects an explicit condition even with a legacy code', async () => {
        await db.insert(feedbacks).values({ authorId: student, title: '旧反馈', content: '内容', targetType: 'general' })
        signIn()
        await AchievementService.adminCreate(definition('custom-feedback', 'feedback_count', 1))
        await AchievementService.adminCreate(definition('FIRST_FEEDBACK', 'login_days', 10))
        signIn(student)
        await Promise.all(Array.from({ length: 3 }, () => AchievementService.listMine(page)))
        expect((await AchievementService.listMine(page)).data?.items?.map((item) => item.achievement.code)).toEqual(['custom-feedback'])
    })

    it('rejects unauthorized changes, duplicate codes and unimplemented generic conditions, including partial updates', async () => {
        const data = definition('unique', 'registration', 1)
        expect((await AchievementService.adminCreate(data)).state.code).toBe('UNAUTHORIZED')
        signIn(student)
        expect((await AchievementService.adminCreate(data)).state.code).toBe('FORBIDDEN')
        signIn()
        const created = (await AchievementService.adminCreate(data)).data!
        expect((await AchievementService.adminCreate(data)).state.code).toBe('ALREADY_EXISTS')
        expect((await AchievementService.adminUpdate({ achievementId: created.id, conditionValue: 2 })).state.code).toBe('INVALID_INPUT')
        expect(CreateAchievementSchema.safeParse({ ...data, conditionType: 'level' }).success).toBe(false)
        expect(CreateAchievementSchema.safeParse({ ...data, code: 'toString', conditionType: 'action' }).success).toBe(false)
        expect(CreateAchievementSchema.safeParse({ ...data, conditionValue: 2 }).success).toBe(false)
        expect((await AchievementService.adminUpdate({ achievementId: created.id, code: 'renamed', conditionType: 'login_days', conditionValue: 100 })).data).toMatchObject({ code: 'renamed', conditionType: 'login_days', conditionValue: 100 })
    })
})

describe('durable administrator image uploads', () => {
    it('stores real bytes, serves them without a session, persists on achievements and goods, and clears them on edit', async () => {
        signIn()
        const response = await upload()
        expect(response.status).toBe(201)
        const { url } = await response.json()
        const imageId = url.split('/').at(-1)
        const stored = (await db.select().from(uploadedImages))[0]
        expect(stored).toMatchObject({ id: imageId, mimeType: 'image/png', uploadedBy: admin })
        expect(Buffer.from(stored.data, 'base64')).toEqual(png)
        const achievement = (await AchievementService.adminCreate(CreateAchievementSchema.parse({ ...definition('image-rule', 'registration', 1), iconUrl: url }))).data!
        const item = (await RedeemService.adminCreateItem(CreateRedeemItemSchema.parse({ name: '真实商品图', imageUrl: url, pointsCost: 10, type: 'physical', status: 'discontinued' }))).data!
        expect(achievement.iconUrl).toBe(url)
        expect(item).toMatchObject({ imageUrl: url, status: 'discontinued' })
        expect((await RedeemService.adminListItems(page)).data).toMatchObject({ total: 1, items: [{ id: item.id }] })
        expect((await RedeemService.listItems(page)).data?.total).toBe(0)
        expect((await AchievementService.adminUpdate(UpdateAchievementSchema.parse({ achievementId: achievement.id, iconUrl: null }))).data?.iconUrl).toBeNull()
        expect((await RedeemService.adminUpdateItem(UpdateRedeemItemSchema.parse({ itemId: item.id, imageUrl: null }))).data?.imageUrl).toBeNull()
        session.data = {}
        const image = await readImage(imageId)
        expect(image.headers.get('content-type')).toBe('image/png')
        expect(image.headers.get('x-content-type-options')).toBe('nosniff')
        expect(Buffer.from(await image.arrayBuffer())).toEqual(png)
        const head = await readImage(imageId, true)
        expect(head.status).toBe(200)
        expect(head.headers.get('content-length')).toBe(String(png.length))
        expect(await head.text()).toBe('')
        expect((await readImage('../secret')).status).toBe(404)
        expect((await readImage(randomUUID())).status).toBe(404)
    })

    it('checks authentication and role before reading or persisting uploads', async () => {
        expect((await upload()).status).toBe(401)
        signIn(student)
        expect((await upload()).status).toBe(403)
        signIn()
        expect((await upload(png, 'image/png', { origin: 'https://evil.example' })).status).toBe(403)
        expect(await db.select().from(uploadedImages)).toHaveLength(0)
    })

    it('accepts the configured public origin when HTTPS is terminated at a reverse proxy', async () => {
        signIn()
        const response = await uploadImage(new Request('http://127.0.0.1:3000/api/images/', {
            method: 'POST', headers: { 'Content-Type': 'image/png', origin: new URL(env.CLIENT_URL).origin }, body: png,
        }))
        expect(response.status).toBe(201)
    })

    it('rejects oversized streams, forged MIME types, executable image URLs and invalid image bytes', async () => {
        signIn()
        expect((await upload(Buffer.alloc(MAX_IMAGE_BYTES + 1))).status).toBe(413)
        expect((await upload(png, 'image/png', { 'content-length': String(MAX_IMAGE_BYTES + 1) })).status).toBe(413)
        expect((await upload(Buffer.from('<svg onload="alert(1)"/>'), 'image/png')).status).toBe(415)
        expect((await upload(png, 'image/jpeg')).status).toBe(415)
        expect((await upload(Buffer.from('<svg/>'), 'image/svg+xml')).status).toBe(415)
        for (const imageUrl of ['javascript:alert(1)', 'data:image/png;base64,test', '//evil.example/image.png', '/api/images/../secret']) {
            expect(CreateRedeemItemSchema.safeParse({ name: '商品', pointsCost: 1, type: 'physical', imageUrl }).success).toBe(false)
        }
        expect(await db.select().from(uploadedImages)).toHaveLength(0)
    })
})
