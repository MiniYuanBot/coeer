import pg from 'pg'
const dbNames = ['coeer', 'postgres', 'coeer_db', 'miniyuan']
const users = ['postgres', 'miniyuan', 'root']
const pwds = ['', 'root', '123456', 'admin', 'postgres123']
const tried = new Set()
for (const u of users) for (const p of pwds) for (const d of dbNames) {
  const url = p ? `postgresql://${u}:${encodeURIComponent(p)}@localhost:5432/${d}` : `postgresql://${u}@localhost:5432/${d}`
  if (tried.has(url)) continue
  tried.add(url)
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 1200 })
  try { await client.connect(); const {rows} = await client.query('select current_user, current_database()'); console.log('OK  ', u, '/', p||'(none)', '->', d); await client.end(); process.exit(0) } catch { /* next */ }
}
console.log('no candidate worked')
