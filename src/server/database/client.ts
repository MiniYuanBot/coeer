import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schemas'
import { env } from '../config'

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
})

export const db = drizzle(pool, { schema })

/** Type of the default connection. */
export type DbClient = typeof db

/** Type of a `db.transaction()` executor. */
export type DbTransaction = Parameters<Parameters<DbClient['transaction']>[0]>[0]

/** Anything queries can run against: the pool or an active transaction. */
export type DbExecutor = DbClient | DbTransaction
