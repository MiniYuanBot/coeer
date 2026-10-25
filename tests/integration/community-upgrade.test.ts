import { afterAll, beforeAll, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createTestDatabase } from '../support/postgres'
import { checkCommunitySchema } from '../../src/server/database/community-schema'

const scope = createTestDatabase('communityupgrade')
const migrations = ['20261021-community.sql', '20261022-community-interactions.sql', '20261023-achievements-images.sql', '20261025-collection-visibility.sql', '20261026-community-roles.sql'].map((file) =>
    readFileSync(new URL(`../../deploy/migrations/${file}`, import.meta.url), 'utf8'))
const userId = '11111111-1111-4111-8111-111111111111'
const postId = '22222222-2222-4222-8222-222222222222'

beforeAll(async () => {
    await scope.initialize()
    await scope.client.query(`
        CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL);
        CREATE TABLE group_posts (id uuid PRIMARY KEY, content text NOT NULL);
        CREATE TYPE group_member_role AS ENUM ('member', 'admin');
        CREATE TABLE groups (id uuid PRIMARY KEY, creator_id uuid REFERENCES users(id));
        CREATE TABLE group_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id uuid REFERENCES groups(id),
            user_id uuid REFERENCES users(id), role group_member_role NOT NULL DEFAULT 'member', status text NOT NULL DEFAULT 'pending',
            joined_at timestamp NOT NULL DEFAULT now(), UNIQUE(group_id, user_id));
        CREATE TABLE bulletins (id uuid PRIMARY KEY);
        CREATE TYPE achievement_condition_type AS ENUM ('count', 'action', 'level');
        CREATE TABLE achievements (code text PRIMARY KEY, condition_type achievement_condition_type, condition_value integer);
        CREATE TABLE cards (id uuid PRIMARY KEY);
        INSERT INTO achievements VALUES ('FIRST_FEEDBACK', 'action', 1);
        INSERT INTO users VALUES ('${userId}', '保留已有账号');
        INSERT INTO groups VALUES ('${postId}', '${userId}');
        INSERT INTO group_members (group_id, user_id, role, status) VALUES ('${postId}', '${userId}', 'admin', 'approved');
        INSERT INTO group_posts VALUES ('${postId}', '保留已有帖子');
    `)
})
afterAll(() => scope.close())

it('upgrades a legacy database and can run again without changing existing accounts, posts or interactions', async () => {
    await expect(checkCommunitySchema(scope.client)).rejects.toMatchObject({ code: '42P01' })
    for (const migration of migrations) await scope.client.query(migration)
    await expect(checkCommunitySchema(scope.client)).resolves.toBeUndefined()

    await scope.client.query(`INSERT INTO notifications (user_id, type, title, content, href) VALUES ($1, 'test', '通知', '内容', '/')`, [userId])
    await scope.client.query('INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2)', [userId, postId])
    await scope.client.query(`INSERT INTO password_resets (user_id, email_hash, token_hash, expires_at) VALUES ($1, 'email', 'token', now() + interval '30 minutes')`, [userId])
    const before = await scope.client.query('SELECT * FROM notifications')
    for (const migration of migrations) await scope.client.query(migration)

    expect((await scope.client.query('SELECT * FROM notifications')).rows).toEqual(before.rows)
    expect((await scope.client.query('SELECT * FROM bookmarks')).rows).toMatchObject([{ user_id: userId, post_id: postId }])
    expect((await scope.client.query('SELECT * FROM password_resets')).rowCount).toBe(1)
    expect((await scope.client.query('SELECT * FROM users')).rows).toEqual([{ id: userId, name: '保留已有账号', avatar_url: null }])
    expect((await scope.client.query('SELECT user_id, role FROM group_members')).rows).toEqual([{ user_id: userId, role: 'owner' }])
    expect((await scope.client.query('SELECT * FROM group_posts')).rows).toEqual([{ id: postId, content: '保留已有帖子' }])
    expect((await scope.client.query('SELECT * FROM achievements')).rows).toEqual([{ code: 'FIRST_FEEDBACK', condition_type: 'action', condition_value: 1, is_hidden: false }])
    await scope.client.query(`INSERT INTO achievements (code, condition_type, condition_value) VALUES ('WELCOME', 'registration', 1), ('HUNDRED_DAYS', 'login_days', 100), ('TEN_THOUSAND', 'points_earned', 10000)`)
    await scope.client.query(`INSERT INTO uploaded_images(mime_type, data, uploaded_by) VALUES ('image/png', 'base64-image', $1)`, [userId])
    for (const migration of migrations) await scope.client.query(migration)
    expect((await scope.client.query('SELECT * FROM uploaded_images')).rows).toMatchObject([{ mime_type: 'image/png', data: 'base64-image', uploaded_by: userId }])
    await scope.client.query(`UPDATE achievements SET is_hidden = true WHERE code = 'HUNDRED_DAYS'`)
    await scope.client.query(`INSERT INTO cards(id, is_hidden) VALUES ($1, true)`, [userId])
    for (const migration of migrations) await scope.client.query(migration)
    expect((await scope.client.query(`SELECT is_hidden FROM achievements WHERE code = 'HUNDRED_DAYS'`)).rows[0].is_hidden).toBe(true)
    expect((await scope.client.query('SELECT is_hidden FROM cards')).rows[0].is_hidden).toBe(true)
})

it('rejects missing tables or columns even when a database connection succeeds', async () => {
    for (const migration of migrations) await scope.client.query(migration)
    const connection = await scope.client.connect()
    try {
        for (const table of ['notifications', 'bookmarks', 'password_resets', 'uploaded_images']) {
            await connection.query('BEGIN')
            try {
                await connection.query(`DROP TABLE ${table}`)
                await expect(checkCommunitySchema(connection)).rejects.toMatchObject({ code: '42P01' })
            } finally { await connection.query('ROLLBACK') }
        }
        await connection.query('BEGIN')
        try {
            await connection.query('ALTER TABLE notifications DROP COLUMN read_at')
            await expect(checkCommunitySchema(connection)).rejects.toMatchObject({ code: '42703' })
        } finally { await connection.query('ROLLBACK') }
    } finally { connection.release() }
    await expect(checkCommunitySchema(scope.client)).resolves.toBeUndefined()
})
