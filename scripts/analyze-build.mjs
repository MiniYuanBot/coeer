import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
    stdio: 'inherit', env: { ...process.env, COEER_BUILD_REPORT: '1' },
})
if (build.status !== 0) process.exit(build.status ?? 1)
const report = JSON.parse(readFileSync('tmp/performance/bundle.json', 'utf8'))
console.table(report.filter(item => /\.(js|css)$/.test(item.name)).slice(0, 12)
    .map(({ name, bytes, gzip }) => ({ name, bytes, gzip })))
console.log('Module sizes and dependency graph: tmp/performance/bundle.json')
