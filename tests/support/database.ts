import { drizzle } from 'drizzle-orm/node-postgres'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import * as schema from '../../src/server/database/schemas'
import { createTestDatabase } from './postgres'

const scope = createTestDatabase('community')
export const client = { close: () => scope.close(), exec: (sql: string) => scope.client.query(sql) }
export const db = drizzle(scope.client, { schema })

/** Build the real Drizzle schema in a fresh PostgreSQL namespace. */
export async function initializeDatabase() {
    await scope.initialize()
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
    for (const statement of statements) {
        // drizzle-kit qualifies enum references with public even for unqualified tables.
        await scope.client.query(statement.replaceAll('"public".', `"${scope.name}".`))
    }
}
export async function resetDatabase() {
    const tables = Object.values(schema).flatMap((value) =>
        is(value, PgTable) ? [`"${scope.name}"."${getTableName(value)}"`] : [],
    )
    await scope.client.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
}
