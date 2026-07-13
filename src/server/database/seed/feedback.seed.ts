import { db } from '../client'
import { count, eq } from 'drizzle-orm'
import { feedbacks } from '../schemas'
import { feedbackQueries } from '../queries'
import { FEEDBACK_STATUS_ARRAY } from '@shared/constants'
import { getSampleFeedbacks } from './testFeedbacks'
import { getSeedUsers, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

export async function seedFeedbacks(options: { clean?: boolean } = {}) {
    const shouldClean = options.clean ?? hasCleanFlag()
    console.log('Start seeding feedbacks...')

    console.log('Test database connection...')
    await feedbackQueries.count({ status: 'invalid' })
    console.log('Connection succeeded')

    const { testUser, adminUser, demoUser } = await getSeedUsers()

    if (shouldClean) {
        console.log('Detect --clean param, clean feedbacks...')
        await db.delete(feedbacks)
        console.log('Feedbacks schema has been cleaned')
    }

    const existingFeedbacks = await db.select().from(feedbacks).limit(1)
    if (existingFeedbacks.length > 0 && !shouldClean) {
        console.log('Feedbacks exist (use --clean to recreate)')

        console.log('\nCurrent feedbacks:')
        for (const stat of FEEDBACK_STATUS_ARRAY) {
            const count = await feedbackQueries.count({ status: stat })
            console.log(`  - ${stat}: ${count}`)
        }

        return
    }

    console.log('\nCreating dev feedbacks...')
    const sampleFeedbacks = getSampleFeedbacks({ testUser, adminUser, demoUser })

    console.log(`Will create ${sampleFeedbacks.length} feedbacks...`)

    for (const [index, fb] of sampleFeedbacks.entries()) {
        await feedbackQueries.create(fb)
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

    console.log(`\n  Anonymous: ${anonymousResult?.count || 0}`)

    console.log('\nFeedbacks seeding succeeded!')
}

if (isMainModule(import.meta.url)) {
    runSeedCli('Feedbacks', ({ clean }) => seedFeedbacks({ clean }))
}
