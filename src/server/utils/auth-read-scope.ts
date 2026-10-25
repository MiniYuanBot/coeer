import { AsyncLocalStorage } from 'node:async_hooks'
import type { SessionUser, SessionUserResponse } from '@shared/contracts'

// Explicitly opt in only for an aggregate read. No cross-request or mutation cache.
const reads = new AsyncLocalStorage<{ user?: Promise<SessionUserResponse<SessionUser>> }>()
export function withAuthReadScope<T>(read: () => Promise<T>): Promise<T> {
    return reads.run({}, read)
}
export function readScopedUser(load: () => Promise<SessionUserResponse<SessionUser>>) {
    const scope = reads.getStore()
    return scope ? scope.user ??= load() : load()
}
