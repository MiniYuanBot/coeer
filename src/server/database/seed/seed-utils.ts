import { inArray } from 'drizzle-orm'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { db } from '../client'
import {
    achievements,
    activities,
    activityParticipants,
    bulletins,
    cards,
    feedbacks,
    feedbackStatusLogs,
    groupMembers,
    groupPosts,
    groups,
    pointTransactions,
    reactions,
    redeemItems,
    redeemOrders,
    replies,
    userAchievements,
    userCards,
    userProfiles,
    users,
    userSubscriptions,
} from '../schemas'

export const seedArgs = process.argv.slice(2)

export function hasCleanFlag(args = seedArgs) {
    return args.includes('--clean')
}

export function isMainModule(importMetaUrl: string) {
    return resolve(fileURLToPath(importMetaUrl)) === resolve(process.argv[1] ?? '')
}

export async function getSeedUsers() {
    const rows = await db.query.users.findMany({
        where: inArray(users.email, ['test@example.com', 'admin@example.com', 'demo@example.com']),
    })

    const testUser = rows.find((user) => user.email === 'test@example.com')
    const adminUser = rows.find((user) => user.email === 'admin@example.com')
    const demoUser = rows.find((user) => user.email === 'demo@example.com')

    if (!testUser || !adminUser || !demoUser) {
        throw new Error('Missing seed users. Please run pnpm seed:users first.')
    }

    return { testUser, adminUser, demoUser }
}

export async function cleanSeedData() {
    console.log('Cleaning seed data in dependency order...')

    await db.delete(redeemOrders)
    await db.delete(redeemItems)
    await db.delete(userAchievements)
    await db.delete(achievements)
    await db.delete(userCards)
    await db.delete(cards)
    await db.delete(pointTransactions)
    await db.delete(activityParticipants)
    await db.delete(activities)
    await db.delete(userSubscriptions)
    await db.delete(bulletins)
    await db.delete(reactions)
    await db.delete(replies)
    await db.delete(feedbackStatusLogs)
    await db.delete(feedbacks)
    await db.delete(groupPosts)
    await db.delete(groupMembers)
    await db.delete(groups)
    await db.delete(userProfiles)
    await db.delete(users)

    console.log('Seed data has been cleaned')
}

export async function runSeedCli(name: string, runner: (options: { clean: boolean }) => Promise<void>) {
    try {
        await runner({ clean: hasCleanFlag() })
        process.exit(0)
    } catch (error) {
        console.error(`${name} seeding failed:`, error)
        process.exit(1)
    }
}
