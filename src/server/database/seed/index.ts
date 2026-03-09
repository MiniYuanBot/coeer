import './users.seed'
import './feedback.seed'

async function seedAll() {
    console.log('Start all seeding procedure...')

    await import('./users.seed')
    await import('./feedback.seed')

    console.log('All seeding done!')
}

seedAll()