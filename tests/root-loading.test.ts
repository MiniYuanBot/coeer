import { expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ fetch: vi.fn(), reward: vi.fn(async () => null) }))
vi.mock('~/functions', () => ({ fetchUserFn: auth.fetch }))
vi.mock('~/functions/points', () => ({ recordDailyVisitFn: auth.reward }))
vi.mock('@/components/coeer', () => ({ PageStatus: () => null, ToastProvider: () => null }))
import { Route } from '../src/app/routes/__root'

it('keeps root authentication but performs no daily reward write while loading or preloading routes', async () => {
    const user = { id: 'test', name: 'Student', role: 'student' }
    auth.fetch.mockResolvedValue(user)
    const beforeLoad = Route.options.beforeLoad as () => Promise<unknown>
    expect(await beforeLoad()).toEqual({ user })
    expect(await beforeLoad()).toEqual({ user })
    expect(auth.fetch).toHaveBeenCalledTimes(2)
    expect(auth.reward).not.toHaveBeenCalled()
})
