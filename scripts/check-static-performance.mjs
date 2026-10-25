import { createServer, request } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Isolated loopback server: serves build files, never imports the app or contacts PostgreSQL.
if (process.platform === 'win32') throw new Error('Run in Linux/WSL: srvx 0.11.7 static path handling is incompatible with Windows separators')
const directory = resolve('tmp/performance')
mkdirSync(directory, { recursive: true })
writeFileSync(`${directory}/static-entry.mjs`, 'export default { fetch: () => new Response("Not found", { status: 404 }) }\n')
const probe = createServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const child = spawn(process.execPath, ['node_modules/srvx/bin/srvx.mjs', '--prod', '--host', '127.0.0.1', '--port', String(port),
    '--static', resolve('dist/client'), `${directory}/static-entry.mjs`], { windowsHide: true, stdio: 'ignore' })
const exit = new Promise(resolve => child.once('exit', resolve))
async function measure(path, encoding) {
    return new Promise((resolve, reject) => {
        const start = performance.now()
        const req = request(`http://127.0.0.1:${port}/${path}`, { headers: { 'Accept-Encoding': encoding } }, response => {
            const ttfb = performance.now() - start
            let bytes = 0
            response.on('data', chunk => { bytes += chunk.length })
            response.on('end', () => resolve({ encoding, status: response.statusCode, ttfb: +ttfb.toFixed(1), total: +(performance.now() - start).toFixed(1), bytes }))
        })
        req.on('error', reject)
        req.setTimeout(30000, () => req.destroy(new Error('Static request timed out')))
        req.end()
    })
}
try {
    for (let attempt = 0; ; attempt++) {
        try { await measure('ready', 'identity'); break } catch (error) { if (attempt === 100) throw error; await delay(100) }
    }
    const assets = readdirSync('dist/client/assets').filter(name => /^(main|vendor-react|vendor-validation)-.*\.js$/.test(name))
    const results = []
    for (const asset of assets) {
        for (const encoding of ['identity', 'gzip', 'br']) {
            for (let repeat = 0; repeat < 3; repeat++) {
                const result = await measure(`assets/${asset}`, encoding)
                if (result.status !== 200) throw new Error(`Static asset returned ${result.status}`)
                results.push({ asset, repeat, ...result })
            }
        }
    }
    writeFileSync(`${directory}/static-timings.json`, JSON.stringify(results, null, 2))
    console.table(results)
} finally { child.kill(); await exit }
