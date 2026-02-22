import './users.seed'
import './feedback.seed'

async function seedAll() {
    console.log('🌱 开始完整 seeding 流程...')

    await import('./users.seed')
    await import('./feedback.seed')

    console.log('✅ 所有 seeding 完成!')
}

seedAll()