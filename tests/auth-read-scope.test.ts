import { expect, it, vi } from 'vitest'
import { readScopedUser, withAuthReadScope } from '../src/server/utils/auth-read-scope'
import { AUTH } from '../src/shared/constants/auth'

it('deduplicates only within the same aggregate read and isolates simultaneous requests', async () => {
    const first = vi.fn(async () => ({ success: false, state: AUTH.UNAUTHORIZED }))
    const second = vi.fn(async () => ({ success: false, state: AUTH.SERVER_ERROR }))
    const [a, b] = await Promise.all([
        withAuthReadScope(() => Promise.all([readScopedUser(first), readScopedUser(first)])),
        withAuthReadScope(() => Promise.all([readScopedUser(second), readScopedUser(second)])),
    ])
    expect(a.map(item => item.state.code)).toEqual(['UNAUTHORIZED', 'UNAUTHORIZED'])
    expect(b.map(item => item.state.code)).toEqual(['SERVER_ERROR', 'SERVER_ERROR'])
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    await readScopedUser(first)
    await readScopedUser(first)
    expect(first).toHaveBeenCalledTimes(3)
})
