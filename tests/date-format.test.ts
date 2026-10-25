import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '@/components/coeer/lib/date'

describe('campus display dates', () => {
    it('renders the same Beijing calendar date across the UTC midnight boundary', () => {
        const instant = '2026-10-24T18:30:00.000Z'
        expect(formatDate(instant)).toBe('10月25日')
        expect(formatDateTime(instant)).toBe('10月25日 02:30')
        expect(formatDateTime(new Date(instant))).toBe(formatDateTime(instant))
    })
})
