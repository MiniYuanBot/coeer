import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { eq } from 'drizzle-orm'
import { databaseUrl } from '../support/postgres'
import { client, db, initializeDatabase, resetDatabase } from '../support/database'
import { users, groups, groupPosts, replies } from '../../src/server/database/schemas'
import { GROUP_CATEGORY_ARRAY } from '../../src/shared/constants'
import { usernameKey } from '../../src/shared/unicode'

vi.mock('~/database/client', async () => ({ db: (await import('../support/database')).db }))
vi.mock('~/utils/session', () => ({ useAppSession: vi.fn() }))
import { userQueries } from '../../src/server/database/queries/users'
import { groupPostQueries } from '../../src/server/database/queries/groupPosts'
import { replyQueries } from '../../src/server/database/queries/replies'
import { GroupPostService } from '../../src/server/services/GroupPostService'
import { ReplyService } from '../../src/server/services/ReplyService'

const indexSql = readFileSync(new URL('../../deploy/migrations/20261026-unicode-usernames.sql', import.meta.url), 'utf8')
const execute = promisify(execFile)
const pool = db.$client
let alice: typeof users.$inferSelect, bob: typeof users.$inferSelect
beforeAll(initializeDatabase)
afterAll(() => client.close())
beforeEach(async () => {
    await resetDatabase()
    await pool.query(indexSql)
    ;[alice, bob] = await db.insert(users).values([
        { email: 'a@unicode.test', name: 'Alice', passwordHash: 'unchanged-hash', role: 'student' },
        { email: 'b@unicode.test', name: 'Bob', passwordHash: 'unchanged-hash', role: 'student' },
    ]).returning()
})

it('database index prevents simultaneous case/NFKC conflicts, while retaining ordinary spaces', async () => {
    const result = await Promise.allSettled([
        userQueries.update({ id: alice.id, name: 'ＡＢＣ' }), userQueries.update({ id: bob.id, name: 'abc' }),
    ])
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    const values = await db.select().from(users)
    expect(new Set(values.map(r => usernameKey(r.name!))).size).toBe(2)
    await userQueries.update({ id: alice.id, name: 'a b' })
    await userQueries.update({ id: bob.id, name: 'ab' })
    await expect(pool.query('UPDATE users SET name=$1 WHERE id=$2', ['Ａ Ｂ', bob.id])).rejects.toMatchObject({ code: '23505' })
    expect((await db.select().from(users)).map(r => r.passwordHash)).toEqual(['unchanged-hash', 'unchanged-hash'])
})

it('default registration names cannot be squatted to prevent email signup', async () => {
    const user = await userQueries.createWithDefaultName({ email: 'new@unicode.test', name: 'Ａlice', passwordHash: 'new-hash', role: 'student' })
    expect(user.name).toMatch(/^Alice-[a-f0-9-]+$/)
    expect(user.email).toBe('new@unicode.test')
    expect(user.passwordHash).toBe('new-hash')
})

it('rejects direct service/query writes as well as HTTP contracts', async () => {
    await expect(userQueries.update({ id: alice.id, name: ' x ' })).rejects.toThrow()
    await expect(userQueries.create({ email: 'x@test.test', name: '\u200b', passwordHash: 'x', role: 'student' })).rejects.toThrow()
    const [group] = await db.insert(groups).values({ name: 'Test', slug: 'unicode', category: GROUP_CATEGORY_ARRAY[0], creatorId: alice.id }).returning()
    const post = { groupId: group.id, authorId: alice.id, type: 'discussion' as const, title: 'Title', content: '\u200b' }
    await expect(groupPostQueries.create(post)).rejects.toThrow()
    expect((await GroupPostService.create(post)).success).toBe(false)
    const reply = { targetId: group.id, targetType: 'group_post' as const, userId: alice.id, content: '\ufeffreply' }
    await expect(replyQueries.create(reply)).rejects.toThrow()
    const result = await ReplyService.create(reply)
    expect(result.success).toBe(false)
    expect(result.state.message).toContain('U+FEFF')
    expect(await db.select().from(groupPosts)).toEqual([])
    expect(await db.select().from(replies)).toEqual([])
})

it('CLI backs up, migrates, verifies, repeats safely and rolls back exact text without overwriting later edits', async () => {
    await pool.query('DROP INDEX users_name_unicode_key')
    await pool.query('UPDATE users SET name=$1 WHERE id=$2', ['\u200b', alice.id])
    await pool.query('UPDATE users SET name=$1 WHERE id=$2', ['BAD BOY', bob.id])
    const [group] = await db.insert(groups).values({ name: 'Test', slug: 'migration', category: GROUP_CATEGORY_ARRAY[0], creatorId: alice.id }).returning()
    const [post] = await db.insert(groupPosts).values({ groupId: group.id, authorId: alice.id, title: '\u200b', content: '👩‍💻\u200b\u200b\r\n\t```x```', type: 'discussion' }).returning()
    const [reply] = await db.insert(replies).values({ userId: alice.id, targetId: post.id, targetType: 'group_post', content: 'ABC\u2060DEF' }).returning()
    const [child] = await db.insert(replies).values({ userId: bob.id, targetId: post.id, parentId: reply.id, targetType: 'group_post', content: '\ufeff❤️' }).returning()
    mkdirSync('tmp', { recursive: true })
    const directory = mkdtempSync(resolve('tmp/unicode-cli-'))
    const { rows: [location] } = await pool.query('SELECT current_schema() AS schema')
    const url = new URL(databaseUrl!)
    url.searchParams.set('options', `-c search_path=${location.schema}`)
    const cli = (...args: string[]) => execute(process.execPath, ['--import', 'tsx', 'scripts/unicode-data.ts', ...args], {
        cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url.toString(), COEER_UNICODE_DIR: directory }, timeout: 30000,
    })
    const scan = join(directory, 'scan.json')
    await cli('scan', '--out', scan)
    const report = JSON.parse(readFileSync(scan, 'utf8'))
    expect(report.counts.users.affected).toBe(1)
    expect(report.characterCounts).toEqual({ 'U+200B': 3, 'U+2060': 1, 'U+FEFF': 1 })
    const applied = JSON.parse((await cli('apply', '--report', scan)).stdout)
    expect(applied.verification.changedFields).toBe(0)
    expect((await cli('verify')).stdout).toContain('"changedFields": 0')
    const manifest = JSON.parse(readFileSync(applied.manifest, 'utf8'))
    expect(manifest.backup.sha256).toHaveLength(64)
    const [afterUser] = await db.select().from(users).where(eq(users.id, alice.id))
    expect(afterUser).toEqual({ ...alice, name: 'bad boy-2' })
    expect((await db.select().from(groupPosts))[0]).toEqual({ ...post, title: 'X', content: '👩‍💻XX\r\n\t```x```' })
    expect((await db.select().from(replies).where(eq(replies.id, child.id)))[0]).toEqual({ ...child, content: 'X❤️' })
    await db.update(groupPosts).set({ title: 'subsequent edit' }).where(eq(groupPosts.id, post.id))
    await expect(cli('rollback', '--manifest', applied.manifest)).rejects.toThrow()
    expect((await db.select().from(users).where(eq(users.id, alice.id)))[0].name).toBe('bad boy-2')
    await db.update(groupPosts).set({ title: 'X' }).where(eq(groupPosts.id, post.id))
    await cli('rollback', '--manifest', applied.manifest)
    expect((await db.select().from(groupPosts))[0]).toEqual(post)
    expect((await db.select().from(replies).where(eq(replies.id, child.id)))[0]).toEqual(child)
    expect((await db.select().from(users).where(eq(users.id, alice.id)))[0]).toEqual({ ...alice, name: '\u200b' })
    expect((await cli('rollback', '--manifest', applied.manifest)).stdout).toContain('已回滚')
    // Original report is valid again after an exact rollback; a subsequent scan/apply is a no-op.
    await cli('apply', '--report', scan)
    const secondScan = join(directory, 'second-scan.json')
    await cli('scan', '--out', secondScan)
    const second = JSON.parse((await cli('apply', '--report', secondScan)).stdout)
    expect(second.verification.changedFields).toBe(0)
    expect(JSON.parse(readFileSync(second.manifest, 'utf8')).plan.changes).toEqual([])
}, 60000)
