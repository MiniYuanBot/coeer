import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'

vi.mock('~/utils/session', () => ({ useAppSession: async () => ({ data: {
    id: '11111111-1111-4111-8111-111111111111',
    passwordVersion: createHash('sha256').update('test-password-hash').digest('hex'),
} }) }))
vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))

import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { achievements, pointTransactions, redeemItems, redeemOrders, userAchievements, users } from '~/database/schemas'
import { PointService } from '~/services/PointService'
import { AchievementService } from '~/services/AchievementService'
import { RedeemService } from '~/services/RedeemService'
import { AuthService } from '~/services/AuthService'
import { redeemQueries } from '~/database/queries/redeems'

const userId = '11111111-1111-4111-8111-111111111111'
beforeAll(initializeDatabase)
beforeEach(async () => {
    vi.restoreAllMocks()
    await resetDatabase()
    await db.insert(users).values({ id: userId, email: 'concurrency@example.test', passwordHash: 'test-password-hash' })
})

it('rolls back the losing buyer debit when two users read the last item before either buys it', async () => {
    const otherId = '22222222-2222-4222-8222-222222222222'
    await db.insert(users).values({ id: otherId, email: 'other@example.test', passwordHash: 'test-password-hash' })
    await db.insert(pointTransactions).values([userId, otherId].map((id) => ({ userId: id, amount: 100, type: 'earn' as const, source: 'adjustment' as const })))
    const [item] = await db.insert(redeemItems).values({ name: 'Last item', description: 'test', pointsCost: 60, stock: 1, type: 'physical' }).returning()
    const current = await AuthService.getCurrentUser()
    vi.spyOn(AuthService, 'getCurrentUser').mockResolvedValueOnce(current)
        .mockResolvedValueOnce({ ...current, data: { ...current.data!, id: otherId } })
    let release!: () => void
    const bothRead = new Promise<void>((resolve) => { release = resolve })
    const find = redeemQueries.findItemById.bind(redeemQueries)
    let readers = 0
    vi.spyOn(redeemQueries, 'findItemById').mockImplementation(async (...args) => {
        const found = await find(...args)
        if (++readers === 2) release()
        await bothRead
        return found
    })
    const outcomes = await Promise.all([1, 2].map(() => RedeemService.redeem({ itemId: item.id, quantity: 1 })))
    expect(outcomes.filter((result) => result.success)).toHaveLength(1)
    expect(await db.select().from(redeemOrders)).toHaveLength(1)
    expect((await db.select().from(redeemItems))[0].stock).toBe(0)
    const debits = await db.select().from(pointTransactions).where(eq(pointTransactions.type, 'spend'))
    expect(debits).toHaveLength(1)
    expect(debits[0].amount).toBe(-60)
})
afterAll(() => client.close())

it('allows only affordable spends during a burst of 40 simultaneous requests', async () => {
    await db.insert(pointTransactions).values({ userId, amount: 100, type: 'earn', source: 'adjustment' })
    const outcomes = await Promise.all(Array.from({ length: 40 }, () => PointService.spend({ userId, amount: 10, source: 'adjustment' })))
    expect(outcomes.filter((result) => result.success)).toHaveLength(10)
    expect(outcomes.filter((result) => result.state.code === 'INSUFFICIENT_POINTS')).toHaveLength(30)
    expect((await PointService.getBalance()).data?.balance).toBe(0)
})

it('inserts 250 achievements in one batch, skips already owned awards and remains idempotent under contention', async () => {
    await db.insert(achievements).values(Array.from({ length: 250 }, (_, i) => ({
        code: `REG_${i}`, name: `Award ${i}`, description: 'Registration', conditionType: 'registration' as const, conditionValue: 1,
    })))
    await db.transaction(async (tx) => {
        const insert = vi.spyOn(tx, 'insert')
        await AchievementService.syncForUser(userId, tx)
        expect(insert).toHaveBeenCalledTimes(1)
        insert.mockClear()
        await AchievementService.syncForUser(userId, tx)
        expect(insert).not.toHaveBeenCalled()
        insert.mockRestore()
    })
    await Promise.all(Array.from({ length: 20 }, () => AchievementService.syncForUser(userId)))
    expect(await db.select().from(userAchievements).where(eq(userAchievements.userId, userId))).toHaveLength(250)
})

it('installs performance indexes on an existing schema and can safely repeat the migration', async () => {
    const sql = readFileSync(new URL('../../deploy/migrations/20261025-concurrency-indexes.sql', import.meta.url), 'utf8')
    const names = Array.from(sql.matchAll(/CREATE INDEX IF NOT EXISTS (\w+)/g), (match) => match[1])
    for (const name of names) await db.$client.query(`DROP INDEX "${name}"`)
    await db.$client.query(sql)
    await db.$client.query(sql)
    const result = await db.$client.query('SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1)', [names])
    expect(result.rows).toHaveLength(7)
})
