/** Versioned policy shared by the browser, server and historical migration. */
export const UNICODE_POLICY_VERSION = 1
export { USERNAME_MAX_CODE_POINTS, usernameError, usernameKey } from './username-policy.mjs'
export type UnicodeIssue = { codePoint: string; position: number; line: number; column: number }
export const codePointLabel = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

export function isForbiddenContentCodePoint(cp: number, next?: number): boolean {
    return (cp <= 0x1f && cp !== 0x09 && cp !== 0x0a && !(cp === 0x0d && next === 0x0a))
        || (cp >= 0x7f && cp <= 0x9f)
        || cp === 0x200b || cp === 0x2060 || cp === 0xfeff
        || cp === 0x061c || cp === 0x200e || cp === 0x200f
        || (cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x206f)
        || (cp >= 0xd800 && cp <= 0xdfff)
        || (cp >= 0xfdd0 && cp <= 0xfdef) || (cp & 0xffff) >= 0xfffe
}

/** Positions count Unicode code points, not UTF-16 units or bytes. */
export function contentUnicodeIssues(value: string): UnicodeIssue[] {
    const chars = Array.from(value)
    const issues: UnicodeIssue[] = []
    let line = 1, column = 1
    chars.forEach((char, index) => {
        const cp = char.codePointAt(0)!
        if (isForbiddenContentCodePoint(cp, chars[index + 1]?.codePointAt(0))) {
            issues.push({ codePoint: codePointLabel(cp), position: index + 1, line, column })
        }
        if (char === '\n') { line++; column = 1 } else column++
    })
    return issues
}

export function contentUnicodeError(value: string): string | undefined {
    const issues = contentUnicodeIssues(value)
    if (!issues.length) return undefined
    return `含有禁止字符：${issues.slice(0, 5).map(i => `${i.codePoint}（第 ${i.line} 行，第 ${i.column} 列）`).join('、')}${issues.length > 5 ? `，共 ${issues.length} 处` : ''}。请修改后提交。`
}

/** No Markdown parsing/normalization: literals, code, whitespace and emoji survive verbatim.
 * Explicitly forbidden characters are forbidden even inside code fences/inline code.
 */
export function replaceForbiddenContent(value: string): string {
    const chars = Array.from(value)
    return chars.map((char, index) => isForbiddenContentCodePoint(char.codePointAt(0)!, chars[index + 1]?.codePointAt(0)) ? 'X' : char).join('')
}
