import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { contentUnicodeIssues, replaceForbiddenContent, usernameError, usernameKey, UNICODE_POLICY_VERSION } from '../../shared/unicode'

// No derived search store exists: ILIKE queries and ordinary indexes read these columns.
// Include notification copies and feedback status notes so hidden text cannot linger there.
export const UNICODE_TEXT_TABLES = {
    users: ['name'], group_posts: ['title', 'content'], replies: ['content'],
    feedbacks: ['title', 'content', 'target_desc'], feedback_status_logs: ['note'],
    bulletins: ['title', 'content'], notifications: ['title', 'content'],
} as const
export type TextTable = keyof typeof UNICODE_TEXT_TABLES
export type TextRecord = { table: TextTable; id: string; fields: Record<string, string | null> }
export type TextChange = { table: TextTable; id: string; field: string; before: string; after: string; reason: string }
export type TextSnapshot = { version: number; identity: string; indexExisted: boolean; records: TextRecord[] }
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"'

export function planUnicodeMigration(records: TextRecord[]) {
    const changes: TextChange[] = []
    const characterCounts: Record<string, number> = {}
    const counts: Record<string, { scanned: number; affected: number; characters: number }> = Object.fromEntries(
        Object.keys(UNICODE_TEXT_TABLES).map(table => [table, { scanned: 0, affected: 0, characters: 0 }]))
    const usernameCharacterCounts: Record<string, number> = {}
    const names = records.filter(r => r.table === 'users').sort((a, b) => a.id.localeCompare(b.id))
    const reserved = new Set<string>()
    const rename = new Map<string, string>()
    for (const row of names) {
        const name = row.fields.name
        if (name == null) continue // Optional, unset nickname; identity/login is email + UUID.
        const error = usernameError(name)
        if (error) rename.set(row.id, error)
        else if (reserved.has(usernameKey(name))) rename.set(row.id, '规范化后昵称重名（忽略 ASCII 大小写）')
        else reserved.add(usernameKey(name))
    }
    let suffix = 1
    for (const row of records) {
        const count = counts[row.table] ??= { scanned: 0, affected: 0, characters: 0 }
        count.scanned++
        let affected = false
        for (const [field, before] of Object.entries(row.fields)) {
            if (before == null) continue
            let after = before, reason = '禁止的 Unicode 码点替换为 X'
            if (row.table === 'users') {
                for (const [index, char] of Array.from(before).entries()) {
                    const invalid = char === ' ' ? index === 0 || index === Array.from(before).length - 1 || Array.from(before)[index - 1] === ' ' : !!usernameError(char)
                    if (invalid) {
                        const key = `U+${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`
                        usernameCharacterCounts[key] = (usernameCharacterCounts[key] ?? 0) + 1
                        count.characters++
                    }
                }
                if (rename.has(row.id)) {
                    do { after = suffix === 1 ? 'bad boy' : `bad boy-${suffix}`; suffix++ } while (reserved.has(usernameKey(after)))
                    reserved.add(usernameKey(after))
                    reason = rename.get(row.id)!
                } else { after = before.normalize('NFKC'); reason = 'NFKC 规范化' }
            } else {
                const issues = contentUnicodeIssues(before)
                for (const issue of issues) characterCounts[issue.codePoint] = (characterCounts[issue.codePoint] ?? 0) + 1
                count.characters += issues.length
                after = replaceForbiddenContent(before)
            }
            if (before !== after) {
                changes.push({ table: row.table, id: row.id, field, before, after, reason })
                affected = true
            }
        }
        if (affected) count.affected++
    }
    return { version: UNICODE_POLICY_VERSION, counts, characterCounts, usernameCharacterCounts, changes }
}

export async function readUnicodeSnapshot(client: PoolClient): Promise<TextSnapshot> {
    const { rows: [location] } = await client.query(`SELECT current_database() AS database, current_schema() AS schema,
        inet_server_addr()::text AS host, inet_server_port() AS port`)
    const { rows: [index] } = await client.query("SELECT to_regclass('users_name_unicode_key') IS NOT NULL AS exists")
    const records: TextRecord[] = []
    for (const [table, fields] of Object.entries(UNICODE_TEXT_TABLES)) {
        const { rows } = await client.query(`SELECT id, ${fields.map(quote).join(', ')} FROM ${quote(table)} ORDER BY id`)
        for (const { id, ...values } of rows) records.push({ table: table as TextTable, id, fields: values })
    }
    return { version: UNICODE_POLICY_VERSION, identity: digest(location), indexExisted: index.exists, records }
}

export async function lockUnicodeTables(client: PoolClient) {
    await client.query("SET LOCAL lock_timeout = '10s'")
    await client.query(`LOCK TABLE ${Object.keys(UNICODE_TEXT_TABLES).map(quote).join(', ')} IN SHARE ROW EXCLUSIVE MODE`)
}

/** Only allowlisted text columns change; IDs, timestamps, authors and counters are untouched. */
export async function writeUnicodeChanges(client: PoolClient, changes: TextChange[], rollback = false) {
    for (const change of changes) {
        const fields: readonly string[] | undefined = UNICODE_TEXT_TABLES[change.table]
        if (!fields?.includes(change.field)) throw new Error('备份包含未知表或字段')
        const before = rollback ? change.after : change.before
        const after = rollback ? change.before : change.after
        const result = await client.query(`UPDATE ${quote(change.table)} SET ${quote(change.field)} = $1
            WHERE id = $2 AND ${quote(change.field)} IS NOT DISTINCT FROM $3`, [after, change.id, before])
        if (result.rowCount !== 1) throw new Error(`内容已改变或记录缺失：${change.table}/${change.id}/${change.field}；整个事务已取消`)
    }
}

export function escapedSample(text: string): string {
    return Array.from(text).slice(0, 240).map(char => {
        const cp = char.codePointAt(0)!
        return cp < 0x20 || cp === 0x7f || contentUnicodeIssues(char).length
            ? `\\u{${cp.toString(16).toUpperCase()}}` : char
    }).join('')
}

export function publicMigrationReport(snapshot: TextSnapshot) {
    const plan = planUnicodeMigration(snapshot.records)
    return { version: snapshot.version, fingerprint: digest(snapshot), identity: snapshot.identity,
        indexExisted: snapshot.indexExisted, counts: plan.counts, characterCounts: plan.characterCounts, usernameCharacterCounts: plan.usernameCharacterCounts,
        changedFields: plan.changes.length,
        examples: plan.changes.slice(0, 12).map(c => ({ ...c, before: escapedSample(c.before), after: escapedSample(c.after) })) }
}
