import { Pool } from 'pg'
import { env } from '../src/server/config/env'
import { checkCommunitySchema } from '../src/server/database/community-schema'

const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 10000, query_timeout: 10000, max: 1 })
try {
    await checkCommunitySchema(pool)
    console.log('通知、密码找回与收藏表结构检查通过。')
} catch (error) {
    const code = (error as { code?: string }).code
    if (code === '42P01' || code === '42703') {
        console.error('社区数据库尚未升级。请在服务器应用目录使用生产环境配置运行 pnpm db:upgrade:community，再重新发布。')
    } else {
        console.error('社区数据库检查失败，请检查数据库连接与访问权限。')
    }
    process.exitCode = 1
} finally {
    await pool.end()
}
