import { seedUsers } from './users.seed'
import { seedCommunity } from './community.seed'
import { seedFeedbacks } from './feedback.seed'
import { seedGamification } from './gamification.seed'
import { cleanSeedData, hasCleanFlag, isMainModule, runSeedCli } from './seed-utils'

export async function seedAll(options: { clean?: boolean } = {}) {
    const clean = options.clean ?? hasCleanFlag()
    console.log('Start all seeding procedure...')

    if (clean) {
        await cleanSeedData()
    }

    await seedUsers({ clean: false })
    await seedCommunity({ clean: false })
    await seedFeedbacks({ clean: false })
    await seedGamification({ clean: false })

    console.log('All seeding done!')
}

if (isMainModule(import.meta.url)) {
    runSeedCli('All', ({ clean }) => seedAll({ clean }))
}
