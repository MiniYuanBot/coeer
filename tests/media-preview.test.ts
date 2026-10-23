import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const executablePath = [
    process.env.COEER_TEST_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path): path is string => !!path && existsSync(path))

describe.skipIf(!executablePath)('collection artwork in Chromium', () => {
    let server: ViteDevServer
    let browser: Browser
    let page: Page
    let origin: string
    let placeholderRequests: number

    beforeAll(async () => {
        server = await createServer({
            configFile: false,
            cacheDir: 'tmp/vite-media-preview-tests',
            plugins: [tailwindcss()],
            resolve: { alias: { '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)) } },
            server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
            optimizeDeps: { entries: ['tests/fixtures/media-preview.html'] },
        })
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
    }, 30000)
    beforeEach(async () => {
        placeholderRequests = 0
        page = await browser.newPage({ viewport: { width: 1000, height: 1000 } })
        await page.route('https://placehold.co/**', (route) => { placeholderRequests++; return route.abort() })
        await page.route('https://images.example.test/custom.svg', (route) => route.fulfill({
            contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="purple"/></svg>',
        }))
        await page.goto(new URL('/tests/fixtures/media-preview.html', origin).href)
        await page.locator('#legacy img').first().waitFor()
    })
    afterEach(async () => { await page?.close() })
    afterAll(async () => { await browser?.close(); await server?.close() })

    it.each([1000, 390])('loads all six legacy images from packaged assets at width %i even with the placeholder host blocked', async (width) => {
        await page.setViewportSize({ width, height: 1000 })
        if (width === 390) await page.evaluate(() => document.documentElement.classList.add('dark'))
        const images = page.locator('#legacy img')
        expect(await images.count()).toBe(6)
        for (const img of await images.all()) {
            await img.scrollIntoViewIfNeeded()
            await img.evaluate((element: HTMLImageElement) => element.decode())
            const result = await img.evaluate((element: HTMLImageElement) => ({
                src: element.getAttribute('src'), width: element.getBoundingClientRect().width,
                height: element.getBoundingClientRect().height, naturalWidth: element.naturalWidth,
                parentWidth: element.parentElement!.getBoundingClientRect().width,
                parentHeight: element.parentElement!.getBoundingClientRect().height,
                cardWidth: element.parentElement!.parentElement!.getBoundingClientRect().width - 2,
            }))
            expect(result.src).toMatch(/^\/demo\/.+\.svg$/)
            expect(result.naturalWidth).toBeGreaterThan(0)
            expect(result.width).toBeGreaterThan(0)
            expect(result.height).toBeGreaterThan(0)
            expect(result.width).toBeCloseTo(result.parentWidth, 1)
            expect(result.height).toBeCloseTo(result.parentHeight, 1)
            expect(result.parentWidth).toBeCloseTo(result.cardWidth, 1)
        }
        expect(placeholderRequests).toBe(0)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })

    it('preserves custom artwork and recovers from a failed source when it changes', async () => {
        const custom = page.locator('#custom img')
        await custom.scrollIntoViewIfNeeded()
        await custom.evaluate((element: HTMLImageElement) => element.decode())
        expect(await custom.getAttribute('src')).toBe('https://images.example.test/custom.svg')
        await page.locator('#recover').scrollIntoViewIfNeeded()
        await page.locator('#recover svg').waitFor()
        expect(await page.locator('#recover img').count()).toBe(0)
        await page.getByRole('button', { name: '加载有效图片' }).click()
        const recovered = page.locator('#recover img')
        await recovered.waitFor()
        await recovered.evaluate((element: HTMLImageElement) => element.decode())
        expect(await recovered.getAttribute('src')).toBe('/demo/card-common.svg')
    })
})
