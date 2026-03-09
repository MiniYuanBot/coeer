import { db } from '../client'
import { inArray, count, eq } from 'drizzle-orm'
import { users } from '../schemas/users'
import { feedbacks } from '../schemas'
import { feedbackQueries } from '../queries'
import { FEEDBACK_STATUS_ARRAY } from '@shared/constants'
import { getSampleFeedbacks } from './testFeedbacks'

const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

async function seedFeedbacks() {
    console.log('Start seeding feedbacks...')

    try {
        console.log('Test database connection...')
        await feedbackQueries.count({ status: 'invalid' })
        console.log('Connection succeeded')

        const existingUsers = await db.query.users.findMany({
            where: inArray(users.email, ['test@example.com', 'admin@example.com', 'demo@example.com'])
        })

        if (existingUsers.length === 0) {
            console.log('Users are not found, please seed users first')
            process.exit(1)
        }

        const testUser = existingUsers.find(u => u.email === 'test@example.com')
        const adminUser = existingUsers.find(u => u.email === 'admin@example.com')
        const demoUser = existingUsers.find(u => u.email === 'demo@example.com')

        if (!testUser || !adminUser) {
            console.log('Miss necessary dev user')
            process.exit(1)
        }

        if (shouldClean) {
            console.log('Detect --clean param, clean feedbacks...')
            try {
                await db.delete(feedbacks)
                console.log('Feedbacks schema has been cleaned')
            } catch (error) {
                console.error('Clean error:', error)
                process.exit(1)
            }
        }

        const existingFeedbacks = await db.select().from(feedbacks).limit(1)
        if (existingFeedbacks.length > 0 && !shouldClean) {
            console.log('feedbacks exist(use --clean param to create new)')

            console.log('\n Current feedbacks:')
            for (const stat of FEEDBACK_STATUS_ARRAY) {
                const count = await feedbackQueries.count({ status: stat })
                console.log(`  - ${stat}: ${count}`)
            }

            process.exit(0)
        }

        console.log('\nCreating dev feedbakcs...')
        const sampleFeedbacks = getSampleFeedbacks({ testUser, adminUser, demoUser })

        console.log(`Will create ${sampleFeedbacks.length} feedbacks...`)

        for (const [index, fb] of sampleFeedbacks.entries()) {
            const feedback = feedbackQueries.create(fb)

            console.log(`  Create feedback ${index + 1}/${sampleFeedbacks.length}: ${fb.title}`)
        }

        const allFeedbacks = await db.select().from(feedbacks)

        const statusStats = await db
            .select({
                status: feedbacks.status,
                count: count(),
            })
            .from(feedbacks)
            .groupBy(feedbacks.status)

        const targetTypeStats = await db
            .select({
                targetType: feedbacks.targetType,
                count: count(),
            })
            .from(feedbacks)
            .groupBy(feedbacks.targetType)

        console.log('\nFeedbacks statistics:')
        console.log(`  Total: ${allFeedbacks.length}`)

        console.log('\n  Status:')
        statusStats.forEach(stat => {
            console.log(`    - ${stat.status}: ${stat.count}`)
        })

        console.log('\n  TargetType:')
        targetTypeStats.forEach(stat => {
            console.log(`    - ${stat.targetType}: ${stat.count}`)
        })

        const [anonymousResult] = await db
            .select({
                count: count()
            })
            .from(feedbacks)
            .where(eq(feedbacks.isAnonymous, true))

        console.log(`\n  Ananymous: ${anonymousResult?.count || 0}`)

        console.log('\nFeedbacks seeding succeeded!')

    } catch (error) {
        console.error('Feedbacks seeding failed:', error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

seedFeedbacks()