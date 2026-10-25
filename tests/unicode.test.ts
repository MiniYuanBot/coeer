import { describe, expect, it } from 'vitest'
import { contentUnicodeError, contentUnicodeIssues, replaceForbiddenContent, usernameError, usernameKey } from '../src/shared/unicode'
import { usernameSchema } from '../src/shared/contracts/unicode'
import { updateProfileSchema } from '../src/shared/contracts/auth'
import { UpdateUserSchema } from '../src/shared/contracts/users'
import { CreateGroupPostSchema, UpdateGroupPostSchema } from '../src/shared/contracts/groupPosts'
import { CreateReplySchema, UpdateReplySchema } from '../src/shared/contracts/replies'
import { CreateFeedbackSchema } from '../src/shared/contracts/feedbacks'
import { CreateBulletinSchema, UpdateBulletinSchema } from '../src/shared/contracts/bulletins'
import { planUnicodeMigration, type TextRecord } from '../src/server/database/unicode-migration'

describe('strict usernames', () => {
    it.each(['中文 A_b-9', 'bad boy', '〇', '𠀀', 'Ａlice１２', '𝒜lice'])('accepts and normalizes %s', name => {
        expect(usernameError(name)).toBeUndefined()
        expect(usernameSchema.parse(name)).toBe(name.normalize('NFKC'))
    })
    it.each(['', ' a', 'a ', 'a  b', 'a\u00a0b', 'a\u3000b', 'a\u2007b', 'a\u202fb', '\tA', 'A\r\nB',
        'A\u200b', '\ufeffA', 'A\u2060', 'A\u200c', 'A\u200d', 'A\ufe0f', '👩‍💻', 'A©', 'A™', 'A.B', 'é', 'عربي', '\ud800', '\u0000'])('rejects without repairing %j', name => {
        expect(usernameSchema.safeParse(name).success).toBe(false)
        expect(updateProfileSchema.safeParse({ name }).success).toBe(false)
        expect(UpdateUserSchema.shape.name.safeParse(name).success).toBe(false)
    })
    it('counts supplementary Han and spaces by code point after NFKC', () => {
        expect(usernameSchema.parse('𠀀'.repeat(63))).toBe('𠀀'.repeat(63))
        expect(usernameSchema.safeParse('𠀀'.repeat(64)).success).toBe(false)
        expect(usernameSchema.safeParse('𠀀'.repeat(31) + ' ' + '𠀀'.repeat(31)).success).toBe(true)
        expect(usernameSchema.safeParse('𠀀'.repeat(32) + ' ' + '𠀀'.repeat(31)).success).toBe(false)
        expect(usernameKey('Ａlice')).toBe(usernameKey('ALICE'))
        expect(usernameKey('a b')).not.toBe(usernameKey('ab'))
    })
})

describe('community text', () => {
    const legal = '# 中文  ＡＢＣ\r\n\n\t**x**  \n$∀x ∈ ℝ$\n👩‍💻 ❤️ 🏳️‍🌈 🇨🇳\nالعربية می\u200cروم हिन्दी\n```js\nconst x = "\\u200B";\n```\n`code`\n'
    it('preserves multilingual text, emoji, layout, Markdown and code byte-for-byte', () => {
        expect(contentUnicodeIssues(legal)).toEqual([])
        expect(replaceForbiddenContent(legal)).toBe(legal)
        expect(CreateReplySchema.shape.content.parse('  reply  \r\n')).toBe('  reply  \r\n')
        expect(CreateReplySchema.shape.content.safeParse(' \t\n').success).toBe(false)
    })
    const forbidden = [0, 1, 8, 11, 12, 13, 31, 127, 128, 159, 0x200b, 0x2060, 0xfeff, 0x61c, 0x200e, 0x200f,
        0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x206a, 0x206f, 0xd800, 0xfdd0, 0xffff, 0x1ffff]
    it.each(forbidden)('rejects U+%s in prose and code; replaces each code point once', cp => {
        const char = String.fromCodePoint(cp)
        expect(replaceForbiddenContent('A' + char + char + 'B')).toBe('AXXB')
        expect(contentUnicodeIssues('```\n' + char + '```')).toHaveLength(1)
        // A lone CR before LF is a legitimate CRLF.
        const content = 'before' + char + 'after'
        for (const schema of [CreateGroupPostSchema.shape.content, UpdateGroupPostSchema.shape.content,
            CreateGroupPostSchema.shape.title, UpdateGroupPostSchema.shape.title, CreateReplySchema.shape.content,
            UpdateReplySchema.shape.content, CreateFeedbackSchema.shape.title, CreateFeedbackSchema.shape.content,
            CreateBulletinSchema.shape.content, UpdateBulletinSchema.shape.title]) {
            expect(schema.safeParse(content).success).toBe(false)
        }
    })
    it('does not trim a BOM or control off the edges before validating', () => {
        expect(CreateReplySchema.shape.content.safeParse('\ufeffhello').success).toBe(false)
        expect(UpdateReplySchema.shape.content.safeParse('hello\ufeff').success).toBe(false)
    })
    it('reports code-point positions and correctly preserves CRLF', () => {
        expect(contentUnicodeIssues('👩‍💻\nA\u200b')).toEqual([{ codePoint: 'U+200B', position: 6, line: 2, column: 2 }])
        expect(contentUnicodeError('\u200b')).toContain('第 1 行，第 1 列')
        expect(replaceForbiddenContent('A\r\nB\rC')).toBe('A\r\nBXC')
        expect(replaceForbiddenContent('Hello\u200B\u200BWorld 👩‍💻')).toBe('HelloXXWorld 👩‍💻')
    })
})

describe('migration planning', () => {
    const user = (id: string, name: string | null): TextRecord => ({ table: 'users', id, fields: { name } })
    const records: TextRecord[] = [user('1', 'BAD BOY'), user('2', 'bad boy-2'), user('3', 'A\u200b'), user('4', 'alice'),
        user('5', 'ＡLICE'), user('6', '张 三'), user('7', null), user('8', 'Ｂob'),
        { table: 'group_posts', id: 'p', fields: { title: 'A\u0000B', content: '```\nHello\u200b\u200bWorld 👩‍💻\n```' } },
        { table: 'replies', id: 'r', fields: { content: 'ABC\u2060DEF\r\n\t❤️' } }]
    it('reserves valid canonical names before allocating deterministic collision-free replacements', () => {
        const plan = planUnicodeMigration(records)
        expect(plan.changes.find(c => c.id === '3')?.after).toBe('bad boy-3')
        expect(plan.changes.find(c => c.id === '5')?.after).toBe('bad boy-4')
        expect(plan.changes.find(c => c.id === '8')?.after).toBe('Bob')
        expect(plan.characterCounts).toEqual({ 'U+0000': 1, 'U+200B': 2, 'U+2060': 1 })
        expect(plan.usernameCharacterCounts).toEqual({ 'U+200B': 1 })
        expect(plan.counts.replies).toEqual({ scanned: 1, affected: 1, characters: 1 })
        const after = records.map(r => ({ ...r, fields: { ...r.fields } }))
        for (const c of plan.changes) after.find(r => r.table === c.table && r.id === c.id)!.fields[c.field] = c.after
        expect(planUnicodeMigration(after).changes).toEqual([])
        expect(after.find(r => r.id === 'p')?.fields.content).toBe('```\nHelloXXWorld 👩‍💻\n```')
        expect(after.find(r => r.id === '7')?.fields.name).toBeNull()
    })
})
