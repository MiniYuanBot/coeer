import pg from 'pg'
const candidates = [
  ['postgres:postgres', 'coeer'],
  ['postgres:password', 'coeer'],
  ['postgres:postgres', 'postgres'],
  ['postgres:password', 'postgres'],
  ['miniyuan:miniyuan', 'coeer'],
  ['postgres', 'coeer'],
  ['postgres', 'postgres'],
]
for (const [auth, db] of candidates) {
  const url = `postgresql://${auth}@localhost:5432/${db}`
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2500 })
  try {
    await client.connect()
    const { rows } = await client.query('select current_database(), current_user, version()')
    console.log('OK  ', url, '->', rows[0].current_database, rows[0].current_user)
    await client.end()
  } catch (e) {
    console.log('FAIL', url, '->', e.code || e.message)
  }
}
