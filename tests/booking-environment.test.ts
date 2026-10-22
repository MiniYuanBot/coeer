import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertBookingEnvironment, spaceEnvironment } from '../src/server/open-space/environment'
import { runtime } from '../src/server/open-space/runtime'
import { communityIdentitySecret } from '../src/server/open-space/coeer-identity'

afterEach(() => vi.unstubAllEnvs())

describe('booking configuration names', () => {
    it('passes the three named configuration groups without forwarding community secrets or translating names', () => {
        const source = {
            NODE_ENV: 'development', DATABASE_URL: 'postgresql://database.invalid/community',
            CLIENT_URL: 'http://localhost:3000', PORT: '3000', SESSION_SECRET: 'community-only',
            BOOKING_ADVANCE_DAYS: '10', CAMPUS_ACCOUNT_FILE: '/private/account.enc.json',
            CAMPUS_COOKIE_FILE: '/private/session.enc.json', CONNECTOR_URL: 'http://127.0.0.1:3002',
            CONNECTOR_TOKEN_FILE: '/private/connector-key.json',
        }
        const result = spaceEnvironment(source)
        expect(result).toMatchObject({
            DATABASE_URL: source.DATABASE_URL, BOOKING_DB_SCHEMA: 'coeer_spaces',
            BOOKING_DATA_SOURCE: 'official', BOOKING_ALLOWED_ORIGIN: source.CLIENT_URL,
            BOOKING_ADVANCE_DAYS: '10', CAMPUS_ACCOUNT_FILE: source.CAMPUS_ACCOUNT_FILE,
            CAMPUS_COOKIE_FILE: source.CAMPUS_COOKIE_FILE, CONNECTOR_URL: source.CONNECTOR_URL,
            CONNECTOR_TOKEN_FILE: source.CONNECTOR_TOKEN_FILE,
        })
        expect(result).not.toHaveProperty('SESSION_SECRET')
        expect(result).not.toHaveProperty('PORT')
        expect(result).not.toHaveProperty('ADAPTER_MODE')
        expect(source).not.toHaveProperty('BOOKING_DATA_SOURCE')
    })

    it('rejects retired variables even alongside the replacement, without including their secret values', () => {
        const source = { OPENSPACE_INTERNAL_AUTH_SECRET: 'never-log-this-value', BOOKING_ENGINE_SIGNING_SECRET: 'new-key' }
        expect(() => spaceEnvironment(source)).toThrow('OPENSPACE_INTERNAL_AUTH_SECRET')
        expect(() => runtime(source)).toThrow('Retired booking variables')
        try { assertBookingEnvironment(source) } catch (error) {
            expect(String(error)).not.toContain('never-log-this-value')
        }
        expect(() => spaceEnvironment({ OPENSPACE_BACKEND_URL: '' })).toThrow('Retired booking variables')
    })

    it('uses the new source/environment settings and enforces production and boolean constraints', () => {
        const common = { DATABASE_URL: 'postgresql://database.invalid/community' }
        expect(runtime(spaceEnvironment({ ...common, NODE_ENV: 'development' }))).toMatchObject({ mode: 'official', environment: 'staging' })
        expect(runtime(spaceEnvironment({ ...common, NODE_ENV: 'test', BOOKING_DATA_SOURCE: 'mock' }))).toMatchObject({ mode: 'mock', environment: 'mock' })
        expect(runtime(spaceEnvironment({ ...common, NODE_ENV: 'production', BOOKING_ALLOWED_ORIGIN: 'https://coeer.example.com' }))).toMatchObject({ environment: 'production' })
        expect(() => runtime(spaceEnvironment({ ...common, NODE_ENV: 'production' }))).toThrow('HTTPS BOOKING_ALLOWED_ORIGIN')
        expect(() => runtime(spaceEnvironment({ ...common, CAMPUS_AUTO_RELOGIN: 'yes' }))).toThrow('Invalid boolean: CAMPUS_AUTO_RELOGIN')
        expect(() => runtime(spaceEnvironment({ ...common, BOOKING_ADVANCE_DAYS: '0' }))).toThrow()
    })

    it('requires the engine signing secret for an external engine and keeps it separate from the connector token', () => {
        vi.stubEnv('BOOKING_ENGINE_URL', 'https://engine.invalid')
        vi.stubEnv('BOOKING_ENGINE_SIGNING_SECRET', '')
        vi.stubEnv('CONNECTOR_TOKEN_FILE', '/private/connector-key.json')
        expect(() => communityIdentitySecret()).toThrow('BOOKING_ENGINE_SIGNING_SECRET')
        vi.stubEnv('BOOKING_ENGINE_SIGNING_SECRET', 'engine-identity-key')
        expect(communityIdentitySecret()).toBe('engine-identity-key')
    })
})
