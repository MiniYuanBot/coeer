/**
 * Client-side redirect target guard.
 * Only same-origin relative paths are accepted — prevents open-redirect
 * abuse through `?redirect=` style parameters (dub uses the same idea
 * with its `?next=` login redirect, validated before navigation).
 */
export function isInternalRedirect(value: string | undefined | null): value is string {
    if (!value || !value.startsWith('/') || /[\\\u0000-\u001f\u007f]/.test(value)) return false
    try {
        const decodedPath = decodeURIComponent(value.split(/[?#]/, 1)[0])
        if (decodedPath.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decodedPath)) return false
        return new URL(value, 'https://coeer.local').origin === 'https://coeer.local'
    } catch {
        return false
    }
}

/** Normalize a raw redirect target to a safe value ('' means app root). */
export function safeRedirect(value: string | undefined | null): string {
    return isInternalRedirect(value) ? value : '/'
}
