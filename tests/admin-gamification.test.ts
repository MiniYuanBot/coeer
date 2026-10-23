import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const executablePath = [process.env.COEER_TEST_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path): path is string => !!path && existsSync(path))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
const imageUrl = '/api/images/33333333-3333-4333-8333-333333333333'
const cases = [
    { kind: 'achievements', field: 'iconUrl', add: '添加成就', save: '保存成就', action: 'createAchievement', update: 'updateAchievement' },
    { kind: 'redeems', field: 'imageUrl', add: '添加物品', save: '保存物品', action: 'createItem', update: 'updateItem' },
]

describe.skipIf(!executablePath)('achievement and shop management in Chromium', () => {
    let server: ViteDevServer
    let browser: Browser
    let page: Page
    let origin: string
    let errors: string[]
    beforeAll(async () => {
        const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
        server = await createServer({
            configFile: false, cacheDir: 'tmp/vite-admin-gamification-tests', plugins: [tailwindcss()],
            resolve: { alias: [
                { find: /^@\/components\/coeer$/, replacement: fixture('markdown-pages-ui.ts') },
                { find: /^~\/functions$/, replacement: fixture('admin-gamification-actions.ts') },
                { find: '@tanstack/react-router', replacement: fixture('admin-gamification-router.tsx') },
                { find: '@', replacement: fileURLToPath(new URL('../src/app', import.meta.url)) },
                { find: '@shared', replacement: fileURLToPath(new URL('../src/shared', import.meta.url)) },
            ] },
            server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
            optimizeDeps: { entries: ['tests/fixtures/admin-gamification.html'] },
        })
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
    }, 30000)
    beforeEach(async () => {
        errors = []
        page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
        page.on('pageerror', (error) => errors.push(error.message))
        await page.route('**/api/images/*', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }))
    })
    afterEach(async () => { await page?.close(); expect(errors).toEqual([]) })
    afterAll(async () => { await browser?.close(); await server?.close() })
    async function open(kind: string) {
        await page.goto(new URL(`/tests/fixtures/admin-gamification.html?kind=${kind}`, origin).href)
        await page.getByRole('button', { name: '选择本地文件', exact: true }).waitFor()
    }
    async function fill(kind: string) {
        await page.locator('[name=name]').fill('测试名称')
        if (kind === 'achievements') await page.locator('[name=description]').fill('测试成就说明')
        else await page.locator('[name=pointsCost]').fill('100')
    }
    async function data() { return JSON.parse((await page.locator('#submitted-data').textContent())!) }

    async function drop(files = [{ name: 'dropped.png', mimeType: 'image/png', buffer: png }]) {
        const transfer = await page.evaluateHandle((items) => {
            const data = new DataTransfer()
            for (const item of items) data.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.mimeType }))
            return data
        }, files.map(({ buffer, ...file }) => ({ ...file, bytes: Array.from(buffer) })))
        const area = page.getByRole('region', { name: /文件区域$/ })
        await area.dispatchEvent('dragenter', { dataTransfer: transfer })
        await area.dispatchEvent('dragover', { dataTransfer: transfer })
        await area.dispatchEvent('drop', { dataTransfer: transfer })
        await transfer.dispose()
    }

    it.each(cases.flatMap((item) => ['button', 'drop'].map((method) => ({ ...item, method }))))('uploads real image bytes through $method and saves the returned URL in $kind', async ({ kind, field, add, action, method }) => {
        await open(kind)
        await fill(kind)
        let uploaded: Buffer | null = null
        await page.route('**/api/images/', async (route) => {
            uploaded = route.request().postDataBuffer()
            expect(route.request().headers()['content-type']).toBe('image/png')
            await route.fulfill({ status: 201, json: { url: imageUrl } })
        })
        if (method === 'drop') await drop()
        else {
            const chooser = page.waitForEvent('filechooser')
            await page.getByRole('button', { name: '选择本地文件', exact: true }).click()
            await (await chooser).setFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })
        }
        await page.waitForFunction(() => document.querySelector<HTMLImageElement>('img[alt$="预览"]')?.naturalWidth === 1)
        await page.getByRole('button', { name: add, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(uploaded).toEqual(png)
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
        expect((await data())[field]).toBe(imageUrl)
        if (kind === 'achievements') expect(await data()).toMatchObject({ conditionType: 'registration', conditionValue: 1 })
        await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[name=name]')?.value === '')
        expect(await page.locator('img[alt$="预览"]').count()).toBe(0)
    })

    it.each(cases)('retains the selected image after invalid or multiple drops in $kind and can still save it', async ({ kind, add, action }) => {
        await open(kind)
        await fill(kind)
        await page.locator('input[type=file]').setInputFiles({ name: 'original.png', mimeType: 'image/png', buffer: png })
        await drop([{ name: 'script.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }])
        expect(await page.getByRole('alert').textContent()).toContain('请选择不超过 5 MB')
        await drop([{ name: 'one.png', mimeType: 'image/png', buffer: png }, { name: 'two.png', mimeType: 'image/png', buffer: png }])
        expect(await page.getByRole('alert').textContent()).toContain('一次只能选择一张图片')
        const region = page.getByRole('region', { name: /文件区域$/ })
        expect(await region.textContent()).toContain('original.png')
        expect(await page.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.files?.[0].name)).toBe('original.png')
        await page.route('**/api/images/', (route) => route.fulfill({ status: 201, json: { url: imageUrl } }))
        await page.getByRole('button', { name: add, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
    })

    it.each(cases)('preserves the $kind draft on upload failure and rejected or failed saves', async ({ kind, add }) => {
        await open(kind)
        await fill(kind)
        await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })
        await page.route('**/api/images/', (route) => route.fulfill({ status: 503, json: { message: '图片上传服务暂不可用' } }))
        await page.getByRole('button', { name: add, exact: true }).click()
        await page.getByRole('alert').waitFor()
        expect(await page.getByRole('alert').textContent()).toContain('图片上传服务暂不可用')
        await page.route('**/api/images/', (route) => route.fulfill({ status: 201, json: { url: imageUrl } }))
        for (const mode of ['response', 'network']) {
            await page.getByLabel('模拟保存失败').selectOption(mode)
            await page.getByRole('button', { name: add, exact: true }).click()
            await page.waitForFunction((message) => document.querySelector('[role=alert]')?.textContent?.includes(message), mode === 'response' ? '服务器拒绝' : '网络中断')
            expect(await page.locator('[name=name]').inputValue()).toBe('测试名称')
            expect(await page.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.files?.length)).toBe(1)
        }
    })

    it.each(cases)('previews and removes existing $kind images and resets drafts on cancellation', async ({ kind, field, save, update }) => {
        await open(kind)
        await page.getByRole('button', { name: '编辑', exact: true }).click()
        await page.locator('img[alt$="预览"]').waitFor()
        await page.getByRole('button', { name: '移除图片' }).click()
        expect(await page.locator(`[name=${field}]`).inputValue()).toBe('')
        await page.getByRole('button', { name: save, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(update)
        expect((await data())[field]).toBeNull()
        await page.getByRole('button', { name: '编辑', exact: true }).click()
        await page.locator('[name=name]').fill('未保存草稿')
        await page.getByRole('button', { name: '取消编辑' }).click()
        expect(await page.locator('[name=name]').inputValue()).toBe('')
        expect(await page.locator('img[alt$="预览"]').count()).toBe(0)
    })

    it('offers concrete conditions and numeric defaults, and displays uploaded achievement icons', async () => {
        await open('achievements')
        await fill('achievements')
        for (const [condition, value] of [['registration', '1'], ['login_days', '100'], ['points_earned', '10000']]) {
            await page.locator('[name=conditionType]').selectOption(condition)
            expect(await page.locator('[name=conditionValue]').inputValue()).toBe(value)
        }
        await page.getByRole('button', { name: '添加成就', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await data()).toMatchObject({ conditionType: 'points_earned', conditionValue: 10000 })
        expect((await data()).code).toMatch(/^ACH_/)
        expect(await page.locator('#achievement-card img').getAttribute('src')).toBe('/demo/card-common.svg')
    })

    it.each(cases)('keeps $kind fields aligned and contained on desktop and mobile, in both themes', async ({ kind }) => {
        await open(kind)
        mkdirSync('tmp/admin-gamification-review', { recursive: true })
        if (kind === 'achievements') await page.locator('[name=conditionType]').selectOption('login_days')
        for (const theme of ['light', 'dark']) {
            await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
            for (const width of [1100, 851, 390]) {
                await page.setViewportSize({ width, height: 1000 })
                const fields = kind === 'achievements' ? ['conditionType', 'conditionValue'] : ['type', 'status']
                const boxes = await Promise.all(fields.map((name) => page.locator(`[name=${name}]`).boundingBox()))
                expect(boxes.every((box) => box && box.width > 100)).toBe(true)
                if (width > 600) {
                    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(1)
                    expect(Math.abs(boxes[0]!.height - boxes[1]!.height)).toBeLessThan(1)
                }
                await drop([{ name: 'long-image-name-'.repeat(12) + '.png', mimeType: 'image/png', buffer: png }])
                await page.locator('img[alt$="预览"]').waitFor()
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
                await page.screenshot({ path: `tmp/admin-gamification-review/${kind}-${theme}-${width}.png`, fullPage: true })
            }
        }
    })

    it.each(cases)('styles open $kind menus in both themes and retains native keyboard selection', async ({ kind }) => {
        await open(kind)
        const select = page.locator(kind === 'achievements' ? '[name=conditionType]' : '[name=status]')
        const option = select.locator('option').nth(1)
        for (const theme of ['light', 'dark']) {
            await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
            await select.click()
            await option.waitFor({ state: 'visible' })
            const bounds = await option.boundingBox()
            expect(bounds!.width).toBeGreaterThan(100)
            const colors = await option.evaluate((element) => ({ background: getComputedStyle(element).backgroundColor, color: getComputedStyle(element).color }))
            expect(colors.background).not.toBe(colors.color)
            await page.screenshot({ path: `tmp/admin-gamification-review/${kind}-${theme}-select.png`, fullPage: true })
            await option.click()
            expect(await select.inputValue()).toBe(kind === 'achievements' ? 'login_days' : 'sold_out')
        }
        await select.focus()
        await page.keyboard.press('Space')
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        expect(await select.inputValue()).toBe(kind === 'achievements' ? 'points_earned' : 'discontinued')
    })
})
