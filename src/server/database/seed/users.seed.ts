import { db } from '../client'
import { users } from '../schemas/users'
import { testUsers } from './testUsers'
import { userQueries } from '../queries'

const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

async function seed() {
    console.log('Start seeding users...')

    try {
        console.log('Test database connection...')
        await userQueries.list({ role: 'student', limit: 1, offset: 0 })
        console.log('Connection succeeded')

        if (shouldClean) {
            console.log('Detect --clean param, clean users...')
            try {
                await db.delete(users)
                console.log('Users schema has been cleaned')
            } catch (error) {
                console.error('Clean error:', error)
                process.exit(1)
            }
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
                console.log(`User exists: ${user.email}`)
            }
        }

        // Find all users without password
        const allUsers = await userQueries.list({limit: 1000, offset: 0})

        console.log(`\nThere are ${allUsers.length} users in database:`)
        allUsers.forEach(user => {
            console.log(`  - ${user.email} (${user.name})`)
        })

        console.log('\nSeeding Succeeded')

    } catch (error) {
        console.error('Seeding Failed:', error)
        process.exit(1)
    } finally {
        process.exit(0)
    }
}

seed()