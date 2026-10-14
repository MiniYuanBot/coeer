import { Pool } from 'pg'
import { env } from '../config'

// Readiness has a separate, bounded connection so a failed probe cannot exhaust
// the business pool. Return only readiness, never connection details or errors.
const healthPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 2000,
  query_timeout: 2000,
  idleTimeoutMillis: 10000,
})
healthPool.on('error', () => { /* The next probe reports unavailable. */ })

export async function readinessResponse() {
  try {
    await healthPool.query('SELECT 1')
    return Response.json(
      { status: 'ok', release: process.env.COEER_RELEASE_ID || 'development' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
