import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { existsSync, mkdirSync, createReadStream, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { client, db, initializeDatabase } from './support/database'
import { bulletins, pointTransactions, users } from '../src/server/database/schemas'

// Runs the real production bundle against a fresh test namespace. The lightweight
// loopback asset adapter avoids srvx's Windows path issue; it is not a load benchmark.
const executablePath = [process.env.COEER_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
    .find(path => path && existsSync(path))
assert.ok(executablePath, 'Set COEER_TEST_BROWSER')
const userId = '11111111-1111-4111-8111-111111111111'
const assetRoot = resolve('dist/client')
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
let server: ReturnType<typeof createServer> | undefined
try {
    await initializeDatabase()
    await db.insert(users).values({ id: userId, email: '2026000001@stu.pku.edu.cn', passwordHash: await bcrypt.hash('Performance-pass-123', 4) })
    await db.insert(bulletins).values({ title: 'SSR 数学公告', content: '保留 **格式** 和公式 $x^2+1$。', type: 'official' })
    const databaseUrl = new URL(process.env.DATABASE_URL!)
    databaseUrl.searchParams.set('options', db.$client.options.options!)
    process.env.DATABASE_URL = databaseUrl.href
    process.env.TSS_PRERENDERING = 'true'
    process.env.NODE_ENV = 'production'
    process.env.SESSION_SECRET = 'isolated-performance-session-secret-do-not-use-in-production'
    const { default: app } = await import(pathToFileURL(resolve('dist/server/server.js')).href)
    server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url!, `http://${request.headers.host}`)
            const asset = resolve(assetRoot, '.' + decodeURIComponent(url.pathname))
            if (asset.startsWith(assetRoot + sep) && (await stat(asset).catch(() => null))?.isFile()) {
                const types: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
                response.setHeader('Content-Type', types[extname(asset)] ?? 'application/octet-stream')
                if (url.pathname.startsWith('/assets/')) response.setHeader('Cache-Control', 'public,max-age=31536000,immutable')
                createReadStream(asset).pipe(response)
                return
            }
            const chunks: Buffer[] = []
            for await (const chunk of request) chunks.push(Buffer.from(chunk))
            const result: Response = await app.fetch(new Request(url, {
                method: request.method, headers: request.headers as HeadersInit,
                ...(!['GET', 'HEAD'].includes(request.method!) ? { body: Buffer.concat(chunks) } : {}),
            }))
            response.statusCode = result.status
            result.headers.forEach((value, name) => { if (name !== 'set-cookie') response.setHeader(name, value) })
            const cookies = result.headers.getSetCookie()
            if (cookies.length) response.setHeader('Set-Cookie', cookies)
            if (result.body) Readable.fromWeb(result.body as any).pipe(response)
            else response.end()
        } catch (error) { console.error(error); response.writeHead(500); response.end('Test server error') }
    })
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as { port: number }).port
    const origin = `http://localhost:${port}`
    const htmlResponse = await fetch(origin)
    assert.equal(htmlResponse.status, 200)
    const html = await htmlResponse.text()
    assert.ok(html.includes('SSR 数学公告') && html.includes('class="katex"'), 'SSR must include formatted content')
    assert.ok(!html.includes('fonts.googleapis.com') && !html.includes('fonts.gstatic.com'))
    browser = await chromium.launch({ executablePath, headless: true })
    let page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    const errors: string[] = [], requests: string[] = [], timings: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => requests.push(request.url()))
    page.on('response', response => { const timing = response.headers()['server-timing']; if (timing) timings.push(timing) })
    await page.goto(origin)
    await page.locator('.katex').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('.coeer-minigong').evaluate((image: HTMLImageElement) => image.naturalWidth > 0), true)
    assert.ok(requests.every(url => url.startsWith(origin) || url.startsWith('data:')), 'No external font/resource requests')
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => {
        const resource = entry as PerformanceResourceTiming
        return { name: new URL(resource.name).pathname, bytes: resource.encodedBodySize, transfer: resource.transferSize, duration: resource.duration }
    }))
    console.log('Guest SSR/hydration and local assets: passed')
    await page.close()
    page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    const loginRequests: string[] = []
    page.on('request', request => loginRequests.push(request.url()))
    page.on('pageerror', error => errors.push(error.message))
    page.on('response', response => { const timing = response.headers()['server-timing']; if (timing) timings.push(timing) })
    await page.goto(`${origin}/login`)
    await page.waitForLoadState('networkidle')
    assert.ok(!loginRequests.some(url => /MathMarkdown|MarkdownRenderer|katex\.min/.test(url)), 'Login must not fetch Markdown/KaTeX')
    await page.locator('input[name="email"]').fill('2026000001@stu.pku.edu.cn')
    await page.locator('input[name="password"]').fill('Performance-pass-123')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.waitForURL(origin + '/')
    await page.locator('h1').filter({ hasText: '动态' }).waitFor()
    await page.locator('a[href="/groups"]:visible').first().click()
    await page.waitForURL(url => url.pathname.replace(/\/$/, '') === '/groups')
    await page.locator('a[href="/"]:visible').first().click()
    await page.waitForURL(origin + '/')
    await page.locator('h1').filter({ hasText: '动态' }).waitFor()
    await page.waitForLoadState('networkidle')
    const rewards = await db.select().from(pointTransactions).where(eq(pointTransactions.userId, userId))
    assert.equal(rewards.filter(row => row.source === 'daily_login').length, 1)
    assert.equal(rewards[0].amount, 5)
    assert.deepEqual(errors, [], 'No hydration or chunk runtime errors')
    assert.ok(timings.some(value => value.includes('posts;dur=')), 'Home endpoint exposes server timings')
    mkdirSync('tmp/performance', { recursive: true })
    await page.screenshot({ path: 'tmp/performance/authenticated-home.png', fullPage: true })
    writeFileSync('tmp/performance/browser.json', JSON.stringify({ htmlBytes: Buffer.byteLength(html), resources, timings, errors }, null, 2))
    console.log('Production SSR, hydration, local fonts/WebP, login, navigation, once-daily reward and Server-Timing: passed')
} catch (error) {
    const pages = browser?.contexts().flatMap(context => context.pages()) ?? []
    console.error('Browser diagnostic URLs:', pages.map(page => page.url()))
    if (pages.length) await pages[pages.length - 1].screenshot({ path: 'tmp/performance/smoke-failure.png' }).catch(() => {})
    throw error
} finally {
    await browser?.close()
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())) }
    const state = (globalThis as any)[Symbol.for('coeer.database.pool')]
    if (state?.pool) { await state.pool.end(); state.pool = undefined }
    await client.close()
}
