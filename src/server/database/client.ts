import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schemas'
import { env } from '../config'

const poolKey = Symbol.for('coeer.database.pool')
type PoolState = { pool?: Pool; closing?: Promise<void> }
const globalState = globalThis as typeof globalThis & { [poolKey]?: PoolState }
const state = globalState[poolKey] ??= {}

function createPool() {
    const pool = new Pool({
        connectionString: env.DATABASE_URL,
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX,
        application_name: 'coeer-community',
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 10000,
        keepAlive: true,
        allowExitOnIdle: true,
    })
    // A lost idle connection should be replaced on demand, not crash the server.
    pool.on('error', (error: NodeJS.ErrnoException) => {
        console.error(JSON.stringify({ event: 'database.pool_error', code: error.code ?? 'CONNECTION_ERROR' }))
    })
    process.once('beforeExit', () => { void closeDatabasePool() })
    return pool
}

// Vite evaluates server modules again on reload. Keep one pool per Node process.
const pool = state.pool ??= createPool()

/** Drain connections for CLI completion or an explicit server shutdown. */
export function closeDatabasePool(): Promise<void> {
    if (!state.pool) return state.closing ?? Promise.resolve()
    if (state.closing) return state.closing
    const closing = state.pool
    state.closing = closing.end().finally(() => {
        if (state.pool === closing) state.pool = undefined
        state.closing = undefined
    })
    return state.closing
}

export const db = drizzle(pool, { schema })

/** Type of the default connection. */
export type DbClient = typeof db

/** Type of a `db.transaction()` executor. */
export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]

/** Anything queries can run against: the pool or an active transaction. */
export type DbExecutor = DbClient | DbTransaction
