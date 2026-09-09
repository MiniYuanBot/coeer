import { eq } from 'drizzle-orm'
import { testUsers } from './testUsers'
import { userQueries } from '../queries'
import { db } from '../client'
import { userProfiles } from '../schemas'
import { cleanSeedData, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

export async function seedUsers(options: { clean?: boolean } = {}) {
    const shouldClean = options.clean ?? hasCleanFlag()
    console.log('Start seeding users...')

    console.log('Test database connection...')
    await userQueries.list({ role: 'student', limit: 1, offset: 0 })
    console.log('Connection succeeded')

    if (shouldClean) {
        console.log('Detect --clean param, clean users and dependent seed data...')
        await cleanSeedData()
    }

    console.log('\nCreating dev users...')

    for (const user of testUsers) {
        const existingUser = await userQueries.findByEmail({ email: user.email })

        if (!existingUser) {
            const created = await userQueries.create({
                email: user.email,
                name: user.name,
                passwordHash: user.passwordHash,
                role: user.role,
                isActive: user.isActive,
            })
            console.log(`Create successful: ${user.email}`)
            await syncProfile(created.id, user.bio)
        } else {
            await userQueries.update({
                id: existingUser.id,
                name: user.name,
                passwordHash: user.passwordHash,
                role: user.role,
            })
            console.log(`User exists, credentials synced: ${user.email}`)
            await syncProfile(existingUser.id, user.bio)
        }
    }

    // Find all users without password
    const allUsers = await userQueries.list({ limit: 1000, offset: 0 })

    console.log(`\nThere are ${allUsers.length} users in database:`)
    allUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.name})`)
    })

    console.log('\nUsers seeding succeeded')
}

/** 保持用户简介与种子一致（首次插入，已存在则更新 bio）。 */
async function syncProfile(userId: string, bio?: string) {
    if (!bio) return
    const existing = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
    })
    if (!existing) {
        await db.insert(userProfiles).values({ userId, bio })
    } else if (existing.bio !== bio) {
        await db.update(userProfiles).set({ bio }).where(eq(userProfiles.userId, userId))
    }
}

if (isMainModule(import.meta.url)) {
    runSeedCli('Users', ({ clean }) => seedUsers({ clean }))
}
