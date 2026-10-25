import { describe, expect, it, vi } from 'vitest'
import { createDailyVisitRecorder } from '../src/app/lib/daily-visit'

describe('nonblocking browser daily visit hints', () => {
    it('coalesces concurrent visits and skips successful repeats until the Beijing date changes', async () => {
        let release!: () => void
        const ready = new Promise<void>(resolve => { release = resolve })
        const request = vi.fn(async () => { await ready; return { userId: 'a', day: '2026-10-26', awarded: true } })
        const record = createDailyVisitRecorder(request)
        const now = new Date('2026-10-26T15:59:59Z')
        const first = record('a', now)
        const again = record('a', now)
        expect(again).toBe(first)
        expect(request).toHaveBeenCalledTimes(1)
        release()
        expect(await first).toBe(true)
        expect(await record('a', now)).toBe(false)
        request.mockResolvedValue({ userId: 'a', day: '2026-10-27', awarded: true })
        expect(await record('a', new Date('2026-10-26T16:00:00Z'))).toBe(true)
        expect(request).toHaveBeenCalledTimes(2)
    })

    it('retries failures and does not mark a different account or an unauthorized response as recorded', async () => {
        const request = vi.fn<() => Promise<{ userId: string; day: string; awarded: boolean } | null>>()
            .mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ userId: 'other', day: '2026-10-26', awarded: true })
            .mockResolvedValue({ userId: 'a', day: '2026-10-26', awarded: false })
        const record = createDailyVisitRecorder(request)
        const now = new Date('2026-10-26T00:00:00Z')
        await expect(record('a', now)).rejects.toThrow('offline')
        expect(await record('a', now)).toBe(false)
        expect(await record('a', now)).toBe(false)
        expect(await record('a', now)).toBe(false)
        expect(await record('a', now)).toBe(false)
        expect(request).toHaveBeenCalledTimes(4)
    })
})
