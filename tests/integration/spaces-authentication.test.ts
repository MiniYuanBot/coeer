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
