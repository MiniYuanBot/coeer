/** Drizzle wraps PostgreSQL errors in cause. Do not confuse email and name conflicts. */
export function isUsernameConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const e = error as { code?: string; constraint?: string; cause?: unknown }
    return (e.code === '23505' && e.constraint === 'users_name_unicode_key')
        || (e.cause !== error && !!e.cause && isUsernameConflict(e.cause))
}
