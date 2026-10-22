import type { Pool } from 'pg'
import { COMMUNITY_SCHEMA_CHECK_SQL } from './community-schema-query.mjs'
export { COMMUNITY_SCHEMA_CHECK_SQL } from './community-schema-query.mjs'

export async function checkCommunitySchema(client: Pick<Pool, 'query'>) {
    await client.query(COMMUNITY_SCHEMA_CHECK_SQL)
}
