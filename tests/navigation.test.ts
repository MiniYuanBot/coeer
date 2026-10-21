import { describe, expect, it } from 'vitest'
import { isInternalRedirect, safeRedirect } from '../src/app/components/coeer/lib/redirect'
import { spaceSearchSchema } from '../src/shared/contracts/spaces'

describe('COEER authentication return paths', () => {
    it.each([
        '/spaces?date=2026-10-22',
        '/feedbacks?view=mine',
        '/groups/book-club/posts',
        '/admin/spaces',
        '/feedbacks?search=%E9%A3%9F%E5%A0%82%20%E5%BB%BA%E8%AE%AE',
    ])('preserves an internal destination: %s', (path) => {
        expect(safeRedirect(path)).toBe(path)
    })
    it.each([
        'https://elsewhere.example',
        '//elsewhere.example',
        '/\\elsewhere.example',
        '/%5c%5celsewhere.example',
        '\\elsewhere.example',
        'javascript:alert(1)',
        '',
        undefined,
        '/\n/elsewhere.example',
    ])('rejects external or ambiguous destinations: %s', (path) => {
        expect(isInternalRedirect(path)).toBe(false)
        expect(safeRedirect(path)).toBe('/')
    })
})
describe('COEER service URL filters', () => {
    it('normalizes malformed filters and parses values from the address bar', () => {
        expect(spaceSearchSchema.parse({ page: -4, capacity: 'bad', module: 'injected' })).toMatchObject({
            page: 1,
            capacity: 0,
            module: 'all',
            q: '',
        })
        expect(
            spaceSearchSchema.parse({ page: '2', capacity: '10', module: 'meeting', q: '讨论' }),
        ).toMatchObject({ page: 2, capacity: 10, module: 'meeting', q: '讨论' })
    })
})
