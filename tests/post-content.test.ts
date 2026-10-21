import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, realpathSync } from 'node:fs'
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

// Real layout checks need a browser; COEER_TEST_BROWSER can supply a custom executable.
describe.skipIf(!executablePath)('post previews and mathematical layout in Chromium', () => {
    let server: ViteDevServer
    let browser: Browser
    let page: Page
    let origin: string

    beforeAll(async () => {
        server = await createServer({
            configFile: false,
            cacheDir: 'tmp/vite-post-content-tests',
            plugins: [tailwindcss()],
            server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
            optimizeDeps: { entries: ['tests/fixtures/post-content.html'] },
        })
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
    }, 30000)
    beforeEach(async () => {
        page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
        await page.goto(new URL('/tests/fixtures/post-content.html', origin).href)
        await page.locator('#long-post button').waitFor()
        await page.evaluate(() => document.fonts.ready)
    })
    afterEach(async () => { await page?.close() })
    afterAll(async () => { await browser?.close(); await server?.close() })

    it('fades only long previews, expands and collapses while keeping short posts complete', async () => {
        const viewport = page.locator('#long-post .coeer-post-content-viewport')
        const button = page.locator('#long-post button')
        expect(await button.getAttribute('aria-expanded')).toBe('false')
        expect(await viewport.evaluate((element) => getComputedStyle(element).maskImage)).toContain('linear-gradient')
        expect(await viewport.evaluate((element) => element.clientHeight)).toBe(168)
        await button.click()
        expect(await button.getAttribute('aria-expanded')).toBe('true')
        expect(await button.textContent()).toContain('收起')
        expect(await viewport.evaluate((element) => getComputedStyle(element).maskImage)).toBe('none')
        expect(await viewport.evaluate((element) => element.clientHeight)).toBeGreaterThan(168)
        await button.click()
        expect(await button.getAttribute('aria-expanded')).toBe('false')
        expect(await viewport.evaluate((element) => element.clientHeight)).toBe(168)
        expect(await page.locator('#short-post button').count()).toBe(0)
        expect(await page.locator('#short-post .coeer-post-content-viewport').evaluate((element) => getComputedStyle(element).maskImage)).toBe('none')
    })

    it('keeps script sizing, fraction rules and math fonts independent of body styles', async () => {
        const result = await page.locator('#formula').evaluate((element) => {
            const inline = element.querySelector('.katex')!
            const base = inline.querySelector('.base > .mord')!
            const scripts = [...inline.querySelectorAll('.msupsub .sizing')]
            const baseBounds = base.getBoundingClientRect()
            return {
                font: getComputedStyle(inline).fontFamily,
                mathFontsLoaded: ['KaTeX_Main', 'KaTeX_Math'].every((family) => [...document.fonts].some((font) => font.family === family && font.status === 'loaded')),
                whiteSpace: getComputedStyle(inline).whiteSpace,
                rules: [...element.querySelectorAll('.frac-line')].map((line) => ({
                    width: parseFloat(getComputedStyle(line).borderBottomWidth),
                    color: getComputedStyle(line).borderBottomColor,
                    textColor: getComputedStyle(line).color,
                    boxSizing: getComputedStyle(line).boxSizing,
                })),
                hasSuperscript: scripts.some((script) => script.textContent === '2' && script.getBoundingClientRect().top < baseBounds.top),
                hasSubscript: scripts.some((script) => script.textContent === 'i' && script.getBoundingClientRect().bottom > baseBounds.bottom),
            }
        })
        expect(result.font).toContain('KaTeX_Main')
        expect(result.mathFontsLoaded).toBe(true)
        expect(result.whiteSpace).toBe('normal')
        expect(result.hasSuperscript).toBe(true)
        expect(result.hasSubscript).toBe(true)
        expect(result.rules.length).toBeGreaterThanOrEqual(3)
        for (const rule of result.rules) {
            expect(rule.width).toBeGreaterThanOrEqual(1)
            expect(rule.color).toBe(rule.textColor)
            expect(rule.boxSizing).toBe('content-box')
        }
    })

    it('reflows narrow screens without horizontal page overflow and preserves the fade in dark mode', async () => {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.evaluate(() => document.documentElement.classList.add('dark'))
        const button = page.locator('#long-post button')
        await button.click()
        await button.click()
        const result = await page.evaluate(() => ({
            width: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            mask: getComputedStyle(document.querySelector('#long-post .coeer-post-content-viewport')!).maskImage,
        }))
        expect(result.scrollWidth).toBeLessThanOrEqual(result.width)
        expect(result.mask).toContain('linear-gradient')
    })
})
