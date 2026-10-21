/** Explicit COEER HTTP acceptance checks. Never calls the official system directly. */
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { addDays, today, validDate } from '../src/shared/open-space/domain'
import type { Booking, Space, Availability, User } from '../src/shared/open-space/domain'

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' },
    origin: { type: 'string', default: process.env.COEER_E2E_ORIGIN || 'http://localhost:3000' },
    state: { type: 'string', default: process.env.COEER_E2E_STORAGE_STATE },
    date: { type: 'string', default: addDays(today(), 1) },
    space: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' },
    purpose: { type: 'string' }, booking: { type: 'string' }, key: { type: 'string' },
    timeout: { type: 'string', default: '300000' },
} })
const command = positionals[0] || 'inspect'
const usage = `COEER booking acceptance (Node 26):
  pnpm exec tsx scripts/coeer-spaces-e2e.ts inspect --origin http://localhost:3000 --state <private-browser-storage-state.json> [--date YYYY-MM-DD]
  pnpm exec tsx scripts/coeer-spaces-e2e.ts submit --state <file> --space <space-id> --date YYYY-MM-DD --start HH:mm --end HH:mm --purpose <purpose>
  pnpm exec tsx scripts/coeer-spaces-e2e.ts cancel --state <file> --booking <booking-id>
  pnpm exec tsx scripts/coeer-spaces-e2e.ts wait --state <file> --booking <booking-id>

inspect only reads COEER. submit/cancel explicitly perform real operations through COEER.
The state file is a private Playwright storageState export from a signed-in COEER browser.
Only matching coeer_session cookies are read; no official account or database credentials are used.`

function minutes(value: string | undefined) {
    if (!value || !/^\d{2}:\d{2}$/.test(value)) throw new Error('Use --start/--end HH:mm')
    const [hour, minute] = value.split(':').map(Number)
    if (hour > 23 || minute > 59) throw new Error('Invalid booking time')
    return hour * 60 + minute
}

async function main() {
    if (values.help) { console.log(usage); return }
    if (!['inspect', 'submit', 'cancel', 'wait'].includes(command)) throw new Error(usage)
    if (!values.state) throw new Error('Pass --state with a private COEER browser storageState export')
    const origin = new URL(values.origin!)
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.href !== origin.origin + '/')
        throw new Error('--origin must be an HTTP(S) origin without credentials or a path')
    if (origin.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname))
        throw new Error('Use HTTPS for a remote COEER host')
    if (!validDate(values.date!)) throw new Error('Use --date YYYY-MM-DD')
    const timeout = Number(values.timeout)
    if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 600000) throw new Error('--timeout must be 1000..600000 milliseconds')
    const state = JSON.parse(readFileSync(values.state, 'utf8')) as { cookies?: Array<{ name: string; value: string; domain: string; path: string; expires?: number; secure?: boolean }> }
    const cookies = state.cookies?.filter(cookie => /^coeer_session(?:\.\d+)?$/.test(cookie.name)
        && typeof cookie.value === 'string'
        && (cookie.domain.replace(/^\./, '') === origin.hostname || origin.hostname.endsWith('.' + cookie.domain.replace(/^\./, '')))
        && '/api/open-space/'.startsWith(cookie.path)
        && (!cookie.secure || origin.protocol === 'https:')
        && (!cookie.expires || cookie.expires < 0 || cookie.expires * 1000 > Date.now()))
    if (!cookies?.length) throw new Error('No current COEER session for this origin in the state file')
    const cookie = cookies.map(value => `${value.name}=${value.value}`).join('; ')
    const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
        const headers = new Headers(init.headers)
        headers.set('Cookie', cookie)
        const response = await fetch(origin.origin + '/api/open-space' + path, {
            ...init, headers, redirect: 'error', signal: AbortSignal.timeout(30000),
        })
        const result = await response.json() as T & { error?: { code?: string; message?: string } }
        if (!response.ok) throw new Error(`${response.status} ${result.error?.code || 'REQUEST_FAILED'}: ${result.error?.message || 'COEER request failed'}`)
        return result
    }
    const config = await api<{ adapter: string; writesEnabled: boolean; paused: boolean; syncEnabled: boolean }>('/config')
    if (config.adapter !== 'official') throw new Error('COEER is not using its official booking adapter; this cannot verify a real reservation')
    const session = await api<{ user: User | null; csrf: string | null }>('/auth/me')
    if (!session.user || !session.csrf) throw new Error('Sign into COEER before exporting the browser session')
    if (command === 'inspect') {
        const rooms = await api<Space[]>('/spaces')
        console.log(JSON.stringify({ command, ...config, date: values.date, bookingPermission: session.user.bookingPermission,
            studentIdentityPresent: !!session.user.studentId, rooms: rooms.map(room => ({ id: room.id, name: room.name, bookable: room.bookable })) }, null, 2))
        if (values.space) {
            const snapshot = await api<Availability>(`/spaces/${encodeURIComponent(values.space)}/availability?date=${values.date}`)
            console.log(JSON.stringify({ spaceId: values.space, stale: snapshot.stale, slots: snapshot.slots }, null, 2))
        }
        return
    }
    const mutate = <T>(path: string, body: unknown, idempotency?: string) => api<T>(path, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin.origin,
            'X-CSRF-Token': session.csrf!, ...(idempotency ? { 'Idempotency-Key': idempotency } : {}) },
        body: JSON.stringify(body),
    })
    let bookingId = values.booking
    if (command === 'submit') {
        if (config.paused || !config.writesEnabled) throw new Error('Enable official writes and resume booking in COEER before submitting')
        if (!session.user.studentId || session.user.bookingPermission !== 'allowed')
            throw new Error('Use a COEER student account with an allowed student ID for immediate acceptance')
        if (!values.space || !values.purpose?.trim()) throw new Error('submit requires --space and --purpose')
        const start = minutes(values.start), end = minutes(values.end)
        if (end <= start) throw new Error('--end must follow --start')
        // Print the key before dispatch so an interrupted call can be inspected or
        // repeated explicitly with the same --key without creating another booking.
        const key = values.key || randomUUID()
        if (!/^[-A-Za-z0-9]{16,80}$/.test(key)) throw new Error('--key must contain 16..80 letters, digits or hyphens')
        console.log(JSON.stringify({ event: 'coeer.submitting', idempotencyKey: key }))
        const booking = await mutate<Booking>('/bookings', { spaceId: values.space, date: values.date, start, end,
            quantity: 1, purpose: values.purpose }, key)
        bookingId = booking.id
        console.log(JSON.stringify({ event: 'coeer.submitted', bookingId, status: booking.status }))
    }
    if (!bookingId) throw new Error('Pass --booking <booking-id>')
    if (command === 'cancel') {
        const booking = await mutate<Booking>(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {})
        console.log(JSON.stringify({ event: 'coeer.cancel_requested', bookingId, status: booking.status }))
    }
    const deadline = Date.now() + timeout
    let previous = ''
    while (Date.now() < deadline) {
        const booking = await api<Booking>(`/bookings/${encodeURIComponent(bookingId)}`)
        if (booking.status !== previous) console.log(JSON.stringify({ bookingId, status: booking.status, message: booking.message }))
        previous = booking.status
        if (command === 'cancel' ? booking.status === 'cancelled' : ['confirmed', 'pending_approval', 'cancelled'].includes(booking.status)) return
        if (['failed', 'manual_review', 'uncertain', 'cancel_uncertain'].includes(booking.status))
            throw new Error(`COEER requires review: ${booking.status}; booking ${bookingId}. No operation was retried.`)
        await delay(1000)
    }
    throw new Error(`Polling timed out; inspect booking ${bookingId} in COEER. No operation was retried.`)
}

main().catch(error => { console.error(error instanceof Error ? error.message : 'COEER_ACCEPTANCE_FAILED'); process.exitCode = 1 })
