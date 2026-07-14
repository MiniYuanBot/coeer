import { testUsers } from './testUsers'
import { userQueries } from '../queries'
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
            await userQueries.create({
                ...user,
                createdAt: new Date(),
            })
            console.log(`Create successful: ${user.email}`)
        } else {
            await userQueries.update({
                id: existingUser.id,
                name: user.name,
                passwordHash: user.passwordHash,
                role: user.role,
            })
            console.log(`User exists, credentials synced: ${user.email}`)
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

if (isMainModule(import.meta.url)) {
    runSeedCli('Users', ({ clean }) => seedUsers({ clean }))
}
