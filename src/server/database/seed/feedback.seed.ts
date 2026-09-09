import { db } from '../client'
import { count, eq } from 'drizzle-orm'
import { feedbacks, feedbackStatusLogs } from '../schemas'
import type { Feedback, DbUser } from '../schemas'
import { feedbackQueries } from '../queries'
import { FEEDBACK_STATUS_ARRAY } from '@shared/constants'
import { getSampleFeedbacks } from './testFeedbacks'
import { getSeedUsers, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

/**
 * 为一条新反馈补上与其最终状态一致的流转记录（提交 → 处理 → 解决/驳回），
 * 让「处理记录」页有内容可演示。
 */
async function seedFeedbackStatusLogs(
    feedback: Feedback,
    original: { status: Feedback['status']; authorId: string },
    users: { adminUser: DbUser; testUser: DbUser; demoUser?: DbUser },
) {
    const stageMinutes = 15
    const base = new Date(Date.now() - 12 * 60 * 60 * 1000) // 假设提交于 12 小时前
    const stages: Array<{ status: Feedback['status']; changedBy: string; note: string; at: Date }> = []

    stages.push({
        status: 'pending',
        changedBy: original.authorId,
        note: '提交反馈',
        at: new Date(base.getTime()),
    })

    if (feedback.status === 'processing' || feedback.status === 'resolved') {
        stages.push({
            status: 'processing',
            changedBy: users.adminUser.id,
            note: '已受理，正在处理中',
            at: new Date(base.getTime() + stageMinutes * 60 * 1000),
        })
    }

    if (feedback.status === 'resolved') {
        stages.push({
            status: 'resolved',
            changedBy: users.adminUser.id,
            note: '已解决并回复用户',
            at: new Date(base.getTime() + 2 * stageMinutes * 60 * 1000),
        })
    }

    if (feedback.status === 'invalid') {
        stages.push({
            status: 'invalid',
            changedBy: users.adminUser.id,
            note: '已驳回：信息不完整或不在受理范围',
            at: new Date(base.getTime() + stageMinutes * 60 * 1000),
        })
    }

    for (const stage of stages) {
        const existing = await db.query.feedbackStatusLogs.findFirst({
            where: (table, { and, eq }) =>
                and(eq(table.feedbackId, feedback.id), eq(table.status, stage.status)),
        })
        if (!existing) {
            await db.insert(feedbackStatusLogs).values({
                feedbackId: feedback.id,
                status: stage.status,
                changedBy: stage.changedBy,
                note: stage.note,
                createdAt: stage.at,
            })
        }
    }
}

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
        const created = await feedbackQueries.create(fb)
        // 状态流转记录：让“处理记录”页有真实的流转时间线可看
        await seedFeedbackStatusLogs(created, fb, { testUser, adminUser, demoUser })
        console.log(`  Create feedback ${index + 1}/${sampleFeedbacks.length}: ${fb.title}`)
    }

    const allFeedbacks = await db.select().from(feedbacks)

    const [logCountResult] = await db
        .select({ count: count() })
        .from(feedbackStatusLogs)

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
    console.log(`  Status logs: ${logCountResult?.count ?? 0}`)

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
