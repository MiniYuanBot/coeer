import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import 'dotenv/config'

export const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl || !/^postgres(?:ql)?:\/\//.test(databaseUrl)) {
    throw new Error('Tests require the PostgreSQL DATABASE_URL configured in .env')
}

/** Cleanup only the schema created by this fixture, never public or application data. */
export function createTestDatabase(label: string) {
    const name = `coeer_test_${label.replace(/[^a-z0-9]/g, '')}_${randomUUID().replaceAll('-', '')}`
    const client = new Pool({ connectionString: databaseUrl, options: `-c search_path=${name}`, max: 5, connectionTimeoutMillis: 10000 })
    let created = false
    return {
        name,
        client,
        async initialize() {
            await client.query(`CREATE SCHEMA "${name}"`)
            created = true
        },
        async close() {
            try {
                if (created) await client.query(`DROP SCHEMA "${name}" CASCADE`)
            } finally {
                await client.end()
            }
        },
    }
}
