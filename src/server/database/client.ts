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
