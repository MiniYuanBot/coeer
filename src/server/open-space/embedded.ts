import type { Server } from 'node:http'
import { createApp } from './app'
import { runtime } from './runtime'
import { loadOfficialConfig } from './adapters/official/config'
import { privateSessionFile } from './adapters/official/http'
import { ManagedSession } from './adapters/official/session'
import { RemoteOfficialAdapter, connectorKey } from './adapters/official/remote'
import { spaceEnvironment } from './environment'

// Keep the booking worker independent of route-module reloads in development.
const key = Symbol.for('coeer.open-space.runtime')
type Embedded = { url: string; close: () => Promise<void> }
const state = globalThis as typeof globalThis & { [key]?: Promise<Embedded> }

export function getEmbeddedSpaceServer(): Promise<Embedded> {
  return state[key] ??= start().catch((error) => {
    delete state[key]
    throw error
  })
}

async function start(): Promise<Embedded> {
  // Prefix every booking setting so its database/port/secrets cannot collide with COEER.
  const values = spaceEnvironment(process.env)
  const settings = runtime(values)
  let adapter
  let official
  if (settings.mode === 'official' && values.OFFICIAL_CONNECTOR_URL) {
    if (!values.OFFICIAL_CONNECTOR_KEY_FILE) throw new Error('Private connector key required')
    adapter = new RemoteOfficialAdapter(values.OFFICIAL_CONNECTOR_URL, connectorKey(values.OFFICIAL_CONNECTOR_KEY_FILE), values.OFFICIAL_WRITES_ENABLED === 'true')
    await adapter.initialize()
  } else if (settings.mode === 'official') {
    if (settings.environment === 'production') throw new Error('Production requires an isolated connector')
    if (!values.OFFICIAL_CONFIG_FILE || !values.OFFICIAL_SESSION_FILE) throw new Error('Official configuration and session required')
    const config = loadOfficialConfig(values.OFFICIAL_CONFIG_FILE, values.OFFICIAL_PUBLICATION_FILE, values.OFFICIAL_WRITES_FILE)
    if (!config.account.profileUserId) throw new Error('Authorized service identity required')
    if (config.allowHTTP && values.OFFICIAL_HTTP_NETWORK_APPROVED !== 'true') throw new Error('Protected HTTP network approval required')
    config.writes.enabled = config.writes.enabled && values.OFFICIAL_WRITES_ENABLED === 'true'
    const mode = values.OFFICIAL_AUTH_MODE ?? 'operator_sso'
    if (!['operator_sso', 'approved_headers'].includes(mode)) throw new Error('Invalid official authentication mode')
    if (mode === 'operator_sso' && !values.OFFICIAL_SESSION_KEY_FILE) throw new Error('Encrypted session key required')
    official = { config, credentials: mode === 'operator_sso'
      ? new ManagedSession(config, values.OFFICIAL_SESSION_FILE, values.OFFICIAL_SESSION_KEY_FILE!).provider
      : privateSessionFile(values.OFFICIAL_SESSION_FILE) }
  }
  const context = await createApp({
    dbPath: values.DATABASE_PATH,
    origin: settings.origin,
    production: settings.hardened,
    environment: settings.environment,
    demo: settings.mode === 'mock' && !settings.hardened && values.DEMO_MODE !== 'false',
    adapterMode: settings.mode,
    adapter,
    official,
    adminStudentId: values.ADMIN_STUDENT_ID,
    adminPassword: settings.adminPassword,
    publicBookingUserId: values.PUBLIC_BOOKING_USER_ID || undefined,
    syncEnabled: values.SYNC_ENABLED === undefined ? undefined : values.SYNC_ENABLED === 'true',
    bookingEnabled: values.BOOKING_ENABLED === undefined ? undefined : values.BOOKING_ENABLED === 'true',
    deferInitialSync: settings.mode === 'official',
    serveClient: false,
    rateLimitKey: request => request.header('x-coeer-account'),
  })
  let server: Server
  try {
    server = await new Promise<Server>((resolve, reject) => {
      const listener = context.app.listen(0, '127.0.0.1', () => resolve(listener))
      listener.once('error', reject)
    })
  } catch (error) {
    context.db.close()
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
      await stopWorker()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      context.db.close()
      delete state[key]
    },
  }
}
