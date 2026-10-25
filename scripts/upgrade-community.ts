import { readFileSync } from 'node:fs'
import { Pool } from 'pg'
import { env } from '../src/server/config/env'
import { checkCommunitySchema } from '../src/server/database/community-schema'

const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000, max: 1 })
try {
    await pool.query(readFileSync(new URL('../deploy/migrations/20261021-community.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261022-community-interactions.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261023-achievements-images.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261025-collection-visibility.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261025-concurrency-indexes.sql', import.meta.url), 'utf8'))
    await pool.query(readFileSync(new URL('../deploy/migrations/20261026-community-roles.sql', import.meta.url), 'utf8'))
    await checkCommunitySchema(pool)
    console.log('社区结构升级完成：群主身份、公告通知模式、个人头像及此前的通知、收藏、图片和查询索引已就绪。')
} finally {
    await pool.end()
}
