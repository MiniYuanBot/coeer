import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { getTableName, is } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import * as schema from '../../src/server/database/schemas'

export const client = new PGlite()
export const db = drizzle(client, { schema })

/** Build COEER's real tables, enums, constraints and relations in memory. */
export async function initializeDatabase() {
    await client.waitReady
    const statements = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
    for (const statement of statements) await client.exec(statement)
}
export async function resetDatabase() {
    const tables = Object.values(schema).flatMap((value) =>
        is(value, PgTable) ? [`"${getTableName(value)}"`] : [],
    )
    await client.exec(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`)
}
