import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { AdapterError } from '../../src/server/open-space/adapters/adapter'
import { AuthenticatedOfficialAdapter } from '../../src/server/open-space/adapters/official/authenticated'
import { AuthenticationRecovery, ManualAuthenticationRequired, loadAccountCredentials, saveAccountCredentials } from '../../src/server/open-space/adapters/official/recovery'
import { ManagedSession, ensureSessionKey, loadSession, saveSession, type ConnectorSession } from '../../src/server/open-space/adapters/official/session'
import { OfficialHTTP } from '../../src/server/open-space/adapters/official/http'
import { LiveOfficialAdapter } from '../../src/server/open-space/adapters/official/live'
import { parseOfficialConfig } from '../../src/server/open-space/adapters/official/config'
import { createApp } from '../../src/server/open-space/app'
import { createTestDatabase, databaseUrl } from '../support/postgres'

let directory: string
let sessionPath: string
let keyPath: string
let server: Server | undefined
beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'coeer-spaces-auth-'))
    sessionPath = join(directory, 'session.enc.json')
    keyPath = join(directory, 'session-key.json')
    ensureSessionKey(keyPath)
    saveSession(sessionPath, keyPath, session('old-cookie'))
})
afterEach(async () => {
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()))
    server = undefined
    if (dirname(resolve(directory)) !== resolve(tmpdir())) throw new Error('Unexpected authentication test directory')
    rmSync(directory, { recursive: true, force: true })
})
function session(cookie: string): ConnectorSession {
    return {
        version: 1, revision: randomUUID(), accountAlias: 'synthetic-service', issuedAt: Date.now(), expiresAt: Date.now() + 8 * 3600000,
        cookies: [{ name: 'synthetic_session', value: cookie, domain: '127.0.0.1', path: '/meeting', expires: -1, secure: false, httpOnly: true, sameSite: 'Lax' }],
    }
}
function configuration(baseURL = 'http://127.0.0.1/meeting/') {
    return parseOfficialConfig({ baseURL, allowHTTP: true, minIntervalMs: 0, account: { alias: 'synthetic-service', profileUserId: 'pinned-profile', bookingPersonId: 'pinned-operator' } })
}

describe('COEER direct official authentication', () => {
    it.each(['profile connection', 'slot timeout'])('completes the first deferred worker sync after a cold %s failure', async failure => {
        const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const scope = createTestDatabase('coldsync')
        const config = parseOfficialConfig({ ...configuration(), rulesSource: 'upstream', modules: ['meeting'], requestTimeoutMs: 100 })
        const manager = new ManagedSession(config, sessionPath, keyPath)
        let failedOnce = false
        const fetcher = vi.fn<typeof fetch>(async (input, init) => {
            const path = new URL(String(input)).pathname
            if (!failedOnce && path.endsWith(failure === 'profile connection' ? '/head/getList.do' : '/meeting/getTimeSlot')) {
                failedOnce = true
                if (failure === 'profile connection') throw new TypeError('synthetic cold connection reset')
                return new Promise((_resolve, reject) => {
                    init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
                })
            }
            if (path.endsWith('/head/getList.do')) return new Response(JSON.stringify({ list: [{ USER_ID: 'pinned-profile' }] }))
            if (path.endsWith('/meeting/reList.do')) {
                const date = new URLSearchParams(init!.body!.toString()).get('MEETING_DATE')!
                return new Response(`<html><head><base href="${config.baseURL}"></head><body>
                    <form id="Form" action="meeting/reList.do" method="post"><input id="MEETING_DATE" value="${date}"></form>
                    <div class="details"><dl data-visible="1"><dt><span class="zhuangtai">空闲中</span></dt>
                    <dt><ol><li>合成空间</li><li>容纳人数：12</li></ol></dt><dt><ul>
                    <li class="planItem green" data="{'id':'synthetic-room','staTime':'10:00','endTime':'10:30','date':'${date}'}"></li>
                    </ul></dt></dl></div><div class="pagination"><span>共1条 共1页</span><li class="active">1</li>
                    <select name="showCount"><option value="50" selected>50</option></select></div></body></html>`)
            }
            if (path.endsWith('/meeting/getTimeSlot')) return new Response(JSON.stringify({
                ROOMMEETING_ID: 'synthetic-room', OPEN_TIME: '10:00', CLOSE_TIME: '10:30', SCALE_VALUE: 30,
                PCRF_COST: 0, TIME_LIMIT: '0', AUDIT_FLAG: '0', data: [{ staTime: '10:00', endTime: '10:30', className: 'green' }],
            }))
            throw new Error('Unexpected synthetic official endpoint')
        })
        const login = vi.fn(async () => session('new-cookie'))
        let context: Awaited<ReturnType<typeof createApp>> | undefined
        let stop: (() => Promise<void>) | undefined
        try {
            await scope.initialize()
            context = await createApp({ databaseUrl, databaseSchema: scope.name, adapterMode: 'official',
                deferInitialSync: true, serveClient: false, horizon: 1, syncEnabled: true, bookingEnabled: false,
                official: { config, credentials: manager.provider, fetcher, wrapAdapter: direct => new AuthenticatedOfficialAdapter(direct,
                    new AuthenticationRecovery({ config, manager, sessionPath, keyPath, statePath: join(directory, 'recovery-state.json'),
                        probe: options => direct.checkConnection(options), login })) } })
            expect(await context.db.all('SELECT * FROM sync_runs')).toHaveLength(0)
            stop = context.startWorker(20)
            await vi.waitFor(async () => {
                expect(await context!.db.all('SELECT status,snapshot_count FROM sync_runs')).toEqual([{ status: 'success', snapshot_count: 2 }])
                expect(await context!.db.all("SELECT state,attempts FROM jobs WHERE type='sync'")).toEqual([{ state: 'done', attempts: 1 }])
            }, { timeout: 5000 })
            expect(failedOnce).toBe(true)
            expect(login).not.toHaveBeenCalled()
            expect(await context.db.all("SELECT * FROM audit WHERE action='sync.failed'")).toHaveLength(0)
            expect(await context.db.setting('paused')).toBe('false')
        } finally {
            await stop?.()
            await context?.db.close()
            await scope.close()
            log.mockRestore()
        }
    })

    it('cancels the startup authentication probe without another request or login', async () => {
        const log = vi.spyOn(console, 'warn').mockImplementation(() => {})
        try {
            const config = configuration()
            const manager = new ManagedSession(config, sessionPath, keyPath)
            const fetcher = vi.fn<typeof fetch>(async (_input, init) => new Promise((_resolve, reject) => {
                init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
            }))
            const direct = new LiveOfficialAdapter(config, new OfficialHTTP(config, manager.provider, fetcher), {
                get: async () => undefined, byRequest: async () => undefined, put: async () => undefined,
            })
            const login = vi.fn(async () => session('new-cookie'))
            const recovery = new AuthenticationRecovery({ config, manager, sessionPath, keyPath, statePath: join(directory, 'recovery-state.json'),
                probe: options => direct.checkConnection(options), login })
            const adapter = new AuthenticatedOfficialAdapter(direct, recovery)
            adapter.beginSync()
            await expect(adapter.listSpaces({ signal: AbortSignal.timeout(100) })).rejects.toMatchObject({ code: 'TIMEOUT' })
            expect(fetcher).toHaveBeenCalledOnce()
            expect(login).not.toHaveBeenCalled()
            expect(recovery.diagnostics()).toMatchObject({ manualRequired: false, attemptsToday: 0 })
        } finally { log.mockRestore() }
    })

    it('recovers once across concurrent reads using encrypted credentials and an independently verified replacement session', async () => {
        let writes = 0
        server = createServer((request, response) => {
            if (!request.url?.startsWith('/meeting/head/getList.do')) {
                writes++
                response.writeHead(500).end()
                return
            }
            if (request.headers.cookie !== 'synthetic_session=new-cookie') {
                response.writeHead(401).end()
                return
            }
            response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ list: [{ USER_ID: 'pinned-profile' }] }))
        })
        await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
        const address = server.address()
        if (!address || typeof address === 'string') throw new Error('Synthetic official service not listening')
        const config = configuration(`http://127.0.0.1:${address.port}/meeting/`)
        const credentialsPath = join(directory, 'account.enc.json')
        const credentialsKey = join(directory, 'account-key.json')
        ensureSessionKey(credentialsKey)
        saveAccountCredentials(credentialsPath, credentialsKey, { accountAlias: config.account.alias, username: 'synthetic-account', password: 'synthetic-password' })
        const manager = new ManagedSession(config, sessionPath, keyPath)
        const direct = new LiveOfficialAdapter(config, new OfficialHTTP(config, manager.provider), { get: async () => undefined, byRequest: async () => undefined, put: async () => undefined })
        const login = vi.fn(async () => {
            expect(loadAccountCredentials(credentialsPath, credentialsKey, config.account.alias).username).toBe('synthetic-account')
            return session('new-cookie')
        })
        const recovery = new AuthenticationRecovery({ config, manager, sessionPath, keyPath, statePath: join(directory, 'recovery-state.json'), probe: () => direct.checkConnection(), login })
        const adapter = new AuthenticatedOfficialAdapter(direct, recovery)
        await Promise.all([adapter.checkConnection(), adapter.checkConnection(), adapter.checkConnection()])
        expect(login).toHaveBeenCalledTimes(1)
        expect(loadSession(sessionPath, keyPath).cookies[0].value).toBe('new-cookie')
        expect(readFileSync(credentialsPath, 'utf8')).not.toContain('synthetic-password')
        expect(readFileSync(sessionPath, 'utf8')).not.toContain('new-cookie')
        expect(adapter.diagnostics()).toMatchObject({ connector: { authentication: 'healthy' }, authenticationRecovery: { manualRequired: false, lastError: null } })
        expect(writes).toBe(0)
    })

    it.each([
        ['manual challenge', () => new ManualAuthenticationRequired(), true],
        ['network cooldown', () => new AdapterError('NETWORK'), false],
    ] as const)('persists the %s stop across restarts without another login attempt', async (_label, failure, manualRequired) => {
        const config = configuration()
        const original = loadSession(sessionPath, keyPath)
        const login = vi.fn(async (): Promise<ConnectorSession> => { throw failure() })
        const settings = { config, sessionPath, keyPath, statePath: join(directory, 'recovery-state.json'), manager: new ManagedSession(config, sessionPath, keyPath), probe: async () => { throw new AdapterError('AUTH_EXPIRED') }, login }
        await expect(new AuthenticationRecovery(settings).beforeRead()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
        const restarted = new AuthenticationRecovery(settings)
        await expect(restarted.beforeRead()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
        expect(login).toHaveBeenCalledTimes(1)
        expect(loadSession(sessionPath, keyPath)).toEqual(original)
        expect(restarted.diagnostics()).toMatchObject({ manualRequired, attemptsToday: 1 })
    })

    it('queues recovery behind an in-flight write and never replays failed create or cancel operations', async () => {
        let started!: () => void
        let release!: () => void
        const ready = new Promise<void>(resolve => { started = resolve })
        const gate = new Promise<void>(resolve => { release = resolve })
        const create = vi.fn(async () => { started(); await gate; throw new AdapterError('AUTH_EXPIRED', 'known-reference') })
        const cancel = vi.fn(async () => { throw new AdapterError('TIMEOUT', 'known-reference') })
        const authentication = { beforeRead: vi.fn(async () => undefined), diagnostics: () => ({ manualRequired: false }) }
        const direct = { create, cancel, diagnostics: () => ({}) } as unknown as LiveOfficialAdapter
        const adapter = new AuthenticatedOfficialAdapter(direct, authentication)
        const pending = adapter.create({ requestId: 'request', spaceId: 'room', module: 'meeting', date: '2026-10-23', start: 600, end: 630, quantity: 1 })
        const rejected = expect(pending).rejects.toMatchObject({ code: 'AUTH_EXPIRED', ref: 'known-reference' })
        await ready
        const read = adapter.checkConnection()
        expect(authentication.beforeRead).not.toHaveBeenCalled()
        release()
        await rejected
        await read
        await expect(adapter.cancel('known-reference')).rejects.toMatchObject({ code: 'TIMEOUT' })
        expect(create).toHaveBeenCalledTimes(1)
        expect(cancel).toHaveBeenCalledTimes(1)
        expect(authentication.beforeRead).toHaveBeenCalledTimes(1)
        await expect(adapter.checkConnection({ signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'TIMEOUT' })
        expect(authentication.beforeRead).toHaveBeenCalledTimes(1)
    })
})
