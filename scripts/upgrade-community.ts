import { readFileSync } from 'node:fs'
import { Pool } from 'pg'
import { env } from '../src/server/config/env'
import { checkCommunitySchema } from '../src/server/database/community-schema'

const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000, max: 1 })
try {
    await pool.query(readFileSync(new URL('../deploy/migrations/20261021-community.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261022-community-interactions.sql', import.meta.url), 'utf8'))
    await checkCommunitySchema(pool)
    console.log('通知、密码找回与收藏表已就绪，现有业务数据已保留。')
} finally {
    await pool.end()
}
