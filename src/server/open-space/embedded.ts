import type { Server } from 'node:http'
import { createApp } from './app'
import { runtime } from './runtime'
import { loadOfficialConfig } from './adapters/official/config'
import { privateSessionFile } from './adapters/official/http'
import { ManagedSession } from './adapters/official/session'
import { RemoteOfficialAdapter, connectorKey } from './adapters/official/remote'
import { spaceEnvironment } from './environment'
import { communityIdentitySecret } from './coeer-identity'
import { AuthenticationRecovery, loadAccountCredentials, loginAuthorizedAccount } from './adapters/official/recovery'
import { AuthenticatedOfficialAdapter } from './adapters/official/authenticated'
import type { LiveOfficialAdapter } from './adapters/official/live'
import { createRuntimeLifecycle, type EmbeddedSpaceRuntime } from './runtime-lifecycle'

// Keep the booking worker independent of route-module reloads in development.
const key = Symbol.for('coeer.open-space.runtime')
const state = globalThis as typeof globalThis & { [key]?: ReturnType<typeof createRuntimeLifecycle> }

export function startEmbeddedSpaceServer(): Promise<EmbeddedSpaceRuntime> {
  const lifecycle = state[key] ??= createRuntimeLifecycle(start, (error) => {
    const code = (error as { code?: unknown })?.code
    console.error(JSON.stringify({ event: 'spaces.runtime.start_failed', code: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'STARTUP_FAILED' }))
  })
  return lifecycle.start()
}

export function getEmbeddedSpaceServer(): Promise<EmbeddedSpaceRuntime> {
  return state[key]?.get() ?? Promise.reject(new Error('Space background runtime has not started'))
}

export function stopEmbeddedSpaceServer(): Promise<void> {
  return state[key]?.stop() ?? Promise.resolve()
}

async function start(): Promise<EmbeddedSpaceRuntime> {
  // Prefix every booking setting so its database/port/secrets cannot collide with COEER.
  const values = spaceEnvironment(process.env)
  const settings = runtime(values)
  let adapter
  let official
  if (settings.mode === 'official' && values.CONNECTOR_URL) {
    if (!values.CONNECTOR_TOKEN_FILE) throw new Error('Private connector key required')
    adapter = new RemoteOfficialAdapter(values.CONNECTOR_URL, connectorKey(values.CONNECTOR_TOKEN_FILE), values.CAMPUS_WRITE_ENABLED === 'true')
    await adapter.initialize()
  } else if (settings.mode === 'official') {
    if (settings.environment === 'production') throw new Error('Production requires an isolated connector')
    if (!values.CAMPUS_API_CONFIG_FILE || !values.CAMPUS_COOKIE_FILE) throw new Error('Official configuration and session required')
    const config = loadOfficialConfig(values.CAMPUS_API_CONFIG_FILE, values.CAMPUS_PUBLIC_ROOMS_FILE, values.CAMPUS_BOOKING_FORM_FILE)
    if (!config.account.profileUserId) throw new Error('Authorized service identity required')
    if (config.allowHTTP && values.CAMPUS_ALLOW_HTTP !== 'true') throw new Error('Protected HTTP network approval required')
    config.writes.enabled = config.writes.enabled && values.CAMPUS_WRITE_ENABLED === 'true'
    const mode = values.CAMPUS_LOGIN_METHOD ?? 'operator_sso'
    if (!['operator_sso', 'approved_headers'].includes(mode)) throw new Error('Invalid official authentication mode')
    if (mode === 'operator_sso' && !values.CAMPUS_COOKIE_KEY_FILE) throw new Error('Encrypted session key required')
    const automatic = values.CAMPUS_AUTO_RELOGIN === 'true'
    if (automatic && (mode !== 'operator_sso' || !values.CAMPUS_ACCOUNT_FILE || !values.CAMPUS_ACCOUNT_KEY_FILE || !values.CAMPUS_RELOGIN_STATE_FILE))
      throw new Error('Private automatic authentication configuration required')
    const manager = mode === 'operator_sso'
      ? new ManagedSession(config, values.CAMPUS_COOKIE_FILE, values.CAMPUS_COOKIE_KEY_FILE!, values.CAMPUS_COOKIE_LEASE_RENEWAL === 'true')
      : undefined
    official = {
      config,
      credentials: manager?.provider ?? privateSessionFile(values.CAMPUS_COOKIE_FILE),
      wrapAdapter: automatic ? (direct: LiveOfficialAdapter) => new AuthenticatedOfficialAdapter(direct, new AuthenticationRecovery({
        config,
        manager: manager!,
        sessionPath: values.CAMPUS_COOKIE_FILE!,
        keyPath: values.CAMPUS_COOKIE_KEY_FILE!,
        statePath: values.CAMPUS_RELOGIN_STATE_FILE!,
        probe: options => direct.checkConnection(options),
        login: () => loginAuthorizedAccount(config, loadAccountCredentials(values.CAMPUS_ACCOUNT_FILE!, values.CAMPUS_ACCOUNT_KEY_FILE!, config.account.alias)),
      })) : undefined,
    }
  }
  const context = await createApp({
    databaseUrl: values.DATABASE_URL,
    databaseSchema: values.BOOKING_DB_SCHEMA,
    origin: settings.origin,
    production: settings.hardened,
    environment: settings.environment,
    demo: false,
    adapterMode: settings.mode,
    adapter,
    official,
    publicBookingUserId: values.BOOKING_PUBLIC_USER_ID || undefined,
    syncEnabled: values.BOOKING_SYNC_ENABLED === undefined ? undefined : values.BOOKING_SYNC_ENABLED === 'true',
    horizon: Number(values.BOOKING_ADVANCE_DAYS ?? 7),
    bookingEnabled: values.BOOKING_SUBMISSIONS_ENABLED === undefined ? undefined : values.BOOKING_SUBMISSIONS_ENABLED === 'true',
    deferInitialSync: settings.mode === 'official',
    serveClient: false,
    communityIdentitySecret: communityIdentitySecret(),
    rateLimitKey: request => request.header('x-coeer-account'),
  })
  let server: Server
  try {
    server = await new Promise<Server>((resolve, reject) => {
      const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
      listener.once('error', reject)
    })
  } catch (error) {
    await context.db.close()
    throw error
  }
  server.unref()
  server.requestTimeout = 30000
  server.headersTimeout = 10000
  const stopWorker = context.startWorker()
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Booking server failed to bind')
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: async () => {
      // Refuse new work before draining timers, requests and any operation whose
      // client deadline expired while the official request was still in flight.
      const listenerClosed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      await Promise.all([stopWorker(), listenerClosed])
      await context.service.drain()
      await context.db.close()
    },
  }
}
