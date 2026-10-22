import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { applyDatabaseMigrations, databaseStatus, runDatabaseOperation, seedDeploymentDemo } from '../../deploy/database.mjs'
import { COMMUNITY_SCHEMA_CHECK_SQL } from '../../src/server/database/community-schema-query.mjs'

const pool = db.$client
const userId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const cardId = '33333333-3333-4333-8333-333333333333'
const migrations = ['20261021-community.sql', '20261022-community-interactions.sql'].map(name => ({
    name, sql: readFileSync(new URL(`../../deploy/migrations/${name}`, import.meta.url), 'utf8'),
}))

beforeAll(initializeDatabase)
afterAll(() => client.close())
beforeEach(async () => {
    await resetDatabase()
    await pool.query(`INSERT INTO users(id,email,name,password_hash,role) VALUES
        ($1,'test@example.com','已有测试账号','preserved-password-hash','student'),
        ($2,'other@example.com','其他账号','other-password-hash','admin')`, [userId, otherId])
})

it('imports only for the requested existing account and preserves credentials, edited content, read state and ownership counts on reruns', async () => {
    await pool.query(`INSERT INTO cards(id,name,image_url,rarity,drop_rate) VALUES ($1,'已有卡片','/demo/card-common.svg','common',1)`, [cardId])
    await pool.query('INSERT INTO user_cards(user_id,card_id,count) VALUES ($1,$3,7),($2,$3,11)', [userId, otherId, cardId])
    await pool.query(`INSERT INTO point_transactions(user_id,amount,type,source) VALUES ($1,50,'earn','adjustment'),($2,33,'earn','adjustment')`, [userId, otherId])
    const originalUsers = (await pool.query('SELECT * FROM users ORDER BY id')).rows
    const first = await seedDeploymentDemo(pool, 'test@example.com')
    expect(first).toMatchObject({ user: 'test@example.com', cards: 1, pointsGranted: 200 })
    expect((await pool.query('SELECT creator_id,is_public FROM groups')).rows).toEqual([{ creator_id: userId, is_public: false }])
    expect((await pool.query('SELECT user_id,role,status FROM group_members')).rows).toEqual([{ user_id: userId, role: 'admin', status: 'approved' }])
    expect((await pool.query('SELECT user_id FROM bookmarks')).rows).toEqual([{ user_id: userId }])
    await pool.query("UPDATE group_posts SET content='用户修改后的内容'")
    await pool.query('UPDATE notifications SET read_at=now()')
    const notification = (await pool.query('SELECT * FROM notifications')).rows
    const second = await seedDeploymentDemo(pool, 'TEST@example.com')
    expect(second.pointsGranted).toBe(0)
    expect((await pool.query('SELECT * FROM users ORDER BY id')).rows).toEqual(originalUsers)
    expect((await pool.query('SELECT content FROM group_posts')).rows).toEqual([{ content: '用户修改后的内容' }])
    expect((await pool.query('SELECT * FROM notifications')).rows).toEqual(notification)
    expect((await pool.query('SELECT user_id,count FROM user_cards ORDER BY user_id')).rows).toEqual([{ user_id: userId, count: 7 }, { user_id: otherId, count: 11 }])
    expect((await pool.query('SELECT user_id,sum(amount)::int AS amount FROM point_transactions GROUP BY user_id ORDER BY user_id')).rows).toEqual([{ user_id: userId, amount: 250 }, { user_id: otherId, amount: 33 }])
    expect((await pool.query('SELECT user_id FROM user_achievements')).rows).toEqual([{ user_id: userId }])
    expect((await pool.query('SELECT * FROM group_posts')).rowCount).toBe(1)
    expect((await pool.query('SELECT * FROM bookmarks')).rowCount).toBe(1)
})

it('serializes concurrent imports and grants the test points only once', async () => {
    const results = await Promise.all([seedDeploymentDemo(pool, 'test@example.com'), seedDeploymentDemo(pool, 'test@example.com')])
    expect(results.map(result => result.pointsGranted).sort()).toEqual([0, 200])
    for (const table of ['groups', 'group_posts', 'bookmarks', 'notifications', 'point_transactions', 'user_cards', 'user_achievements']) {
        expect((await pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(1)
    }
})

it('rejects missing or disabled users without creating accounts or demo data', async () => {
    await expect(seedDeploymentDemo(pool, 'missing@example.com')).rejects.toThrow('不会创建账号')
    await pool.query('UPDATE users SET is_active=false WHERE id=$1', [userId])
    await expect(seedDeploymentDemo(pool, 'test@example.com')).rejects.toThrow('已停用')
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(2)
    expect((await pool.query('SELECT * FROM groups')).rowCount).toBe(0)
    expect((await pool.query('SELECT * FROM point_transactions')).rowCount).toBe(0)
})

it('rolls back all imported rows if the last notification insert fails', async () => {
    await pool.query('ALTER TABLE notifications RENAME TO notifications_unavailable')
    try {
        await expect(seedDeploymentDemo(pool, 'test@example.com')).rejects.toMatchObject({ code: '42P01' })
        for (const table of ['groups', 'group_posts', 'bookmarks', 'point_transactions', 'cards', 'achievements']) {
            expect((await pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(0)
        }
    } finally { await pool.query('ALTER TABLE notifications_unavailable RENAME TO notifications') }
})

it('detects and upgrades a legacy schema, and keeps the connection usable after failed migration rollback', async () => {
    await pool.query('DROP TABLE bookmarks,notifications,password_resets')
    expect((await databaseStatus(pool, COMMUNITY_SCHEMA_CHECK_SQL)).ready).toBe(false)
    await applyDatabaseMigrations(pool, migrations, COMMUNITY_SCHEMA_CHECK_SQL)
    expect((await databaseStatus(pool, COMMUNITY_SCHEMA_CHECK_SQL)).ready).toBe(true)
    await applyDatabaseMigrations(pool, migrations, COMMUNITY_SCHEMA_CHECK_SQL)
    await expect(applyDatabaseMigrations(pool, [{ name: 'broken.sql', sql: 'BEGIN; CREATE TABLE must_rollback(id int); SELECT * FROM missing_migration_table; COMMIT;' }], COMMUNITY_SCHEMA_CHECK_SQL)).rejects.toMatchObject({ code: '42P01' })
    expect((await pool.query("SELECT to_regclass('must_rollback') AS name")).rows[0].name).toBeNull()
    expect((await pool.query('SELECT * FROM users')).rowCount).toBe(2)
})

it('blocks seeding after a failed backup before any demo rows are written', async () => {
    await expect(runDatabaseOperation({ action: 'db-seed', user: 'test@example.com', schemaCheck: COMMUNITY_SCHEMA_CHECK_SQL }, pool,
        () => { throw new Error('backup unavailable') })).rejects.toThrow('backup unavailable')
    expect((await pool.query('SELECT * FROM point_transactions')).rowCount).toBe(0)
    expect((await pool.query('SELECT * FROM groups')).rowCount).toBe(0)
})
