import { afterAll, beforeAll, expect, it } from 'vitest'
import { DB } from '../../src/server/open-space/db'
import { createTestDatabase, databaseUrl } from '../support/postgres'

const scope = createTestDatabase('spacesconcurrency')
let db: DB
beforeAll(async () => { await scope.initialize(); db = await DB.open(databaseUrl, scope.name) })
afterAll(async () => { if (db) await db.close(); await scope.close() })

it('retains database serialization between independent pools using the same booking schema', async () => {
    const peer = await DB.open(databaseUrl, scope.name)
    try {
        await db.set('shared-counter', '0')
        await Promise.all(Array.from({ length: 20 }, (_, i) => {
            const connection = i % 2 ? db : peer
            return connection.tx(async () => {
                const current = Number(await connection.setting('shared-counter'))
                await connection.set('shared-counter', String(current + 1))
            })
        }))
        expect(await db.setting('shared-counter')).toBe('20')
    } finally { await peer.close() }
})

it('keeps read connections available while 40 writes queue, supports nesting and recovers after rollback', async () => {
    let release!: () => void, entered!: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { entered = resolve })
    const first = db.tx(async () => { entered(); await blocked })
    await started
    const writes = Array.from({ length: 40 }, (_, i) => db.tx(() => db.tx(() => db.set(`burst-${i}`, String(i)))))
    // Attach rejection handlers before any assertions so cleanup always drains work.
    const completed = Promise.allSettled(writes)
    try {
        await new Promise<void>((resolve) => setImmediate(resolve))
        expect(db.pool.waitingCount).toBe(0)
        expect(db.pool.totalCount - db.pool.idleCount).toBe(1)
        expect(await db.get('SELECT 42 AS value')).toEqual({ value: 42 })
    } finally { release(); await first; await completed }
    expect((await completed).every((result) => result.status === 'fulfilled')).toBe(true)
    expect(await db.all("SELECT * FROM settings WHERE key LIKE 'burst-%'")).toHaveLength(40)
    await expect(db.tx(async () => { await db.set('rolled-back', 'bad'); throw new Error('rollback') })).rejects.toThrow('rollback')
    expect(await db.setting('rolled-back')).toBe('')
    await db.tx(() => db.set('recovered', 'yes'))
    expect(await db.setting('recovered')).toBe('yes')
})
