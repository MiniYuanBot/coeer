// Shared by TypeScript application code and standalone Node provisioning (including SSH).
export const USERNAME_MAX_CODE_POINTS = 63
const codePointLabel = cp => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')

/** @param {string} raw @returns {string | undefined} */
export function usernameError(raw) {
    // Check BEFORE NFKC: NBSP, ideographic space and other whitespace must not become U+0020.
    for (const [index, char] of Array.from(raw).entries()) {
        if (!/^[\p{L}\p{N}_ -]$/u.test(char) || /\p{Extended_Pictographic}/u.test(char)) {
            return `昵称第 ${index + 1} 个字符 ${codePointLabel(char.codePointAt(0))} 不允许使用；仅允许汉字、英文字母、数字、下划线、连字符和中间的单个半角空格。`
        }
    }
    const name = raw.normalize('NFKC')
    const length = Array.from(name).length
    if (length < 1 || length > USERNAME_MAX_CODE_POINTS) return '昵称须为 1–63 个 Unicode 字符（空格计入长度）。'
    if (!/^[\p{Unified_Ideograph}\u3007a-zA-Z0-9_ -]+$/u.test(name)) return '昵称仅允许汉字、英文字母、数字、下划线、连字符和半角空格。'
    if (name.startsWith(' ') || name.endsWith(' ') || name.includes('  ')) return '昵称不能以空格开头或结尾，也不能包含连续空格。'
    return undefined
}

/** @param {string} name */
export const usernameKey = (name) => name.normalize('NFKC').replace(/[A-Z]/g, char => char.toLowerCase())
