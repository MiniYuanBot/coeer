import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

// Local runtime validation. No SSH, production files, privileged ports or database.
const executable = process.env.NGINX_BIN || 'nginx'
const prefix = resolve('tmp/performance/nginx-check').replaceAll('\\', '/') + '/'
mkdirSync(`${prefix}logs`, { recursive: true })
mkdirSync(`${prefix}temp`, { recursive: true })
const received = []
const body = 'console.log("static response");\n'.repeat(1000)
const upstream = createServer((request, response) => {
    received.push(request.headers)
    if (request.url === '/assets/missing.js') { response.writeHead(404); response.end('missing'); return }
    response.setHeader('Content-Type', request.url.startsWith('/assets/') ? 'text/javascript' : 'application/json')
    if (!request.url.startsWith('/assets/')) response.setHeader('Cache-Control', 'private, no-store')
    response.end(body)
})
await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve))
const probe = createServer()
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
const port = probe.address().port
await new Promise(resolve => probe.close(resolve))
const template = readFileSync('deploy/nginx/coeer.conf', 'utf8')
    .replace('127.0.0.1:3000', `127.0.0.1:${upstream.address().port}`)
    .replace('listen 80;', `listen 127.0.0.1:${port};`)
writeFileSync(`${prefix}nginx.conf`, `worker_processes 1;\npid nginx.pid;\nerror_log error.log;\nevents { worker_connections 128; }\nhttp { access_log off;\n${template}\n}`)
const args = ['-p', prefix, '-c', 'nginx.conf']
let child
try {
    const syntax = spawnSync(executable, [...args, '-t'], { encoding: 'utf8', windowsHide: true })
    assert.equal(syntax.status, 0, syntax.stderr || String(syntax.error))
    child = spawn(executable, [...args, '-g', 'daemon off;'], { stdio: 'ignore', windowsHide: true })
    const origin = `http://127.0.0.1:${port}`
    for (let attempt = 0; ; attempt++) {
        try { await (await fetch(origin)).arrayBuffer(); break } catch (error) { if (attempt === 100) throw error; await delay(50) }
    }
    const asset = await fetch(`${origin}/assets/main-test.js`, { headers: { 'Accept-Encoding': 'br, gzip' } })
    assert.equal(asset.status, 200)
    assert.equal(asset.headers.get('content-encoding'), 'gzip')
    assert.match(asset.headers.get('vary'), /accept-encoding/i)
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable')
    assert.equal(await asset.text(), body)
    const page = await fetch(`${origin}/api/test`, { headers: { Cookie: 'test=private' } })
    assert.equal(page.headers.get('cache-control'), 'private, no-store')
    await page.arrayBuffer()
    const missing = await fetch(`${origin}/assets/missing.js`)
    assert.equal(missing.status, 404)
    assert.equal(missing.headers.get('cache-control'), null)
    await missing.arrayBuffer()
    assert.ok(received.every(headers => !headers['accept-encoding'] && headers.connection !== 'upgrade'))
    assert.ok(received.some(headers => headers.cookie === 'test=private'))
    console.log('Nginx syntax, gzip, immutable assets, uncached 404/private API and upstream encoding/connection headers: passed')
} finally {
    if (child) {
        const exited = new Promise(resolve => child.once('exit', resolve))
        spawnSync(executable, [...args, '-s', 'quit'], { windowsHide: true, timeout: 5000 })
        await Promise.race([exited, delay(5000)])
        if (child.exitCode === null) child.kill()
    }
    upstream.closeAllConnections()
    await new Promise(resolve => upstream.close(resolve))
}
