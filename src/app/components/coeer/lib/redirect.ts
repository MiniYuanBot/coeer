/**
 * Client-side redirect target guard.
 * Only same-origin relative paths are accepted — prevents open-redirect
 * abuse through `?redirect=` style parameters (dub uses the same idea
 * with its `?next=` login redirect, validated before navigation).
 */
export function isInternalRedirect(value: string | undefined | null): value is string {
    if (!value) return false
    return value.startsWith('/') && !value.startsWith('//') && !value.includes('://')
}

/** Normalize a raw redirect target to a safe value ('' means app root). */
export function safeRedirect(value: string | undefined | null): string {
    return isInternalRedirect(value) ? value : '/'
}
