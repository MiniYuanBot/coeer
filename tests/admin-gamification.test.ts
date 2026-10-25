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
const cardCase = { kind: 'cards', field: 'imageUrl', add: '添加卡片', save: '保存卡片', action: 'createCard', update: 'updateCard' }
const allCases = [...cases, cardCase]

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
            optimizeDeps: { entries: ['tests/fixtures/admin-gamification.html'], include: ['react-dom'] },
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
        await page.getByRole('link', { name: /^新建/ }).click()
        await page.getByRole('button', { name: '选择本地文件', exact: true }).waitFor()
    }
    async function fill(kind: string) {
        await page.locator('[name=name]').fill('测试名称')
        if (kind === 'achievements') await page.locator('[name=description]').fill('测试成就说明')
        else if (kind === 'redeems') await page.locator('[name=pointsCost]').fill('100')
    }
    async function data() { return JSON.parse((await page.locator('#submitted-data').textContent())!) }

    it.each([{ kind: 'achievements', noun: '成就', filter: '类型', option: '累计登录天数', key: 'conditionType=login_days' }, { kind: 'cards', noun: '卡片', filter: '稀有度', option: '稀有', key: 'rarity=rare' }])('keeps $kind visibility scopes and type filters in the URL without mixing forms into the list', async ({ kind, noun, filter, option, key }) => {
        await page.goto(new URL(`/tests/fixtures/admin-gamification.html?kind=${kind}`, origin).href)
        const scope = page.getByRole('group', { name: `${noun}管理范围`, exact: true })
        for (const prefix of ['全部', '公开', '隐藏']) expect(await scope.getByRole('button', { name: prefix + noun, exact: true }).count()).toBe(1)
        await scope.getByRole('button', { name: '隐藏' + noun, exact: true }).click()
        await page.getByRole('group', { name: filter, exact: true }).getByRole('button', { name: option, exact: true }).click()
        expect(page.url()).toContain('scope=hidden')
        expect(page.url()).toContain(key)
        await page.reload()
        expect(await scope.getByRole('button', { name: '隐藏' + noun, exact: true }).getAttribute('aria-pressed')).toBe('true')
        expect(await page.locator('.coeer-filter-toolbar .coeer-filter-group, .coeer-filter-toolbar .coeer-filter-options').count()).toBe(0)
        await page.getByRole('button', { name: '清除筛选', exact: true }).click()
        expect(page.url()).not.toContain(key)
        expect(page.url()).toContain('scope=hidden')
    })

    it('moves redemption details into their scope and keeps item types available in both scopes', async () => {
        await page.goto(new URL('/tests/fixtures/admin-gamification.html?kind=redeems', origin).href)
        expect(await page.getByRole('button', { name: '兑换详情', exact: true }).count()).toBe(1)
        await page.getByRole('button', { name: '兑换详情', exact: true }).click()
        await page.getByRole('region', { name: '兑换详情表' }).getByText('待处理', { exact: true }).waitFor()
        expect(await page.getByRole('cell', { name: '测试用户', exact: true }).count()).toBe(1)
        await page.getByRole('group', { name: '类型', exact: true }).getByRole('button', { name: '实体物品', exact: true }).click()
        expect(page.url()).toContain('scope=orders')
        expect(page.url()).toContain('type=physical')
        await page.getByRole('button', { name: '全部物品', exact: true }).click()
        expect(await page.getByRole('region', { name: '兑换详情表' }).count()).toBe(0)
        expect(await page.getByRole('link', { name: '编辑', exact: true }).count()).toBe(1)
    })

    it.each([{ kind: 'achievements', update: 'updateAchievement', save: '保存成就' }, { kind: 'cards', update: 'updateCard', save: '保存卡片' }])('saves the selected hidden visibility from the $kind editor', async ({ kind, update, save }) => {
        await page.goto(new URL(`/tests/fixtures/admin-gamification.html?kind=${kind}`, origin).href)
        await page.getByRole('link', { name: '编辑', exact: true }).click()
        await page.locator('[name=isHidden]').selectOption('hidden')
        await page.getByRole('button', { name: save, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(update)
        expect(await data()).toMatchObject({ isHidden: true })
    })

    it.each([{ kind: 'collection', title: '卡片' }, { kind: 'frontAchievements', title: '成就' }])('renders the independent $title frontend with the same scope and option layout', async ({ kind, title }) => {
        await page.goto(new URL(`/tests/fixtures/admin-gamification.html?kind=${kind}`, origin).href)
        expect(await page.locator('h1').textContent()).toBe(title)
        expect(await page.locator('.coeer-filter-panel > .coeer-tabs.coeer-scope-tabs.coeer-scrollbar').count()).toBe(1)
        expect(await page.locator('.coeer-filter-options').count()).toBe(1)
        expect(await page.locator('.coeer-filter-toolbar .coeer-filter-group, .coeer-filter-toolbar .coeer-filter-options').count()).toBe(0)
        if (kind === 'frontAchievements') expect(await page.getByRole('button', { name: /抽一张卡/ }).count()).toBe(0)
        await page.setViewportSize({ width: 390, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })

    it.each(allCases)('separates the $kind list, creation and edit routes and restores the record after reload', async ({ kind }) => {
        await page.goto(new URL(`/tests/fixtures/admin-gamification.html?kind=${kind}`, origin).href)
        expect(await page.locator('.coeer-filter-panel > .coeer-tabs.coeer-scope-tabs.coeer-scrollbar').count()).toBe(1)
        expect(await page.locator('form:not([role=search])').count()).toBe(0)
        expect(await page.locator('.coeer-filter-toolbar .coeer-filter-group').count()).toBe(0)
        const create = page.locator('.coeer-page-actions').getByRole('link', { name: /^新建/ })
        expect(await create.getAttribute('href')).toContain(`/admin/${kind}/create`)
        const edit = page.getByRole('link', { name: '编辑', exact: true })
        expect(await edit.getAttribute('href')).toMatch(new RegExp(`/admin/${kind}/[^/]+/edit`))
        await edit.click()
        await page.locator('[name=name]').waitFor()
        expect(await page.locator('h1').textContent()).toMatch(/^编辑/)
        const original = await page.locator('[name=name]').inputValue()
        await page.locator('[name=name]').fill('未保存的修改')
        await page.reload()
        expect(await page.locator('[name=name]').inputValue()).toBe(original)
        await page.getByRole('link', { name: '取消', exact: true }).click()
        await page.getByRole('link', { name: /^新建/ }).click()
        expect(await page.locator('h1').textContent()).toMatch(/^新建/)
        expect(await page.locator('[name=name]').inputValue()).toBe('')
    })
    it('keeps card deletion explicit, retains failures in the dialog and sends the selected ID', async () => {
        await open('cards')
        await page.getByRole('link', { name: '返回列表', exact: true }).click()
        await page.getByRole('button', { name: '删除', exact: true }).click()
        let dialog = page.getByRole('dialog', { name: '删除卡片', exact: true })
        await dialog.getByRole('button', { name: '取消', exact: true }).click()
        expect(await page.locator('#submitted-action').textContent()).toBe('')
        await page.getByLabel('模拟保存失败').selectOption('response')
        await page.getByRole('button', { name: '删除', exact: true }).click()
        dialog = page.getByRole('dialog', { name: '删除卡片', exact: true })
        await dialog.getByRole('button', { name: '确认删除', exact: true }).click()
        await dialog.getByRole('alert').waitFor()
        expect(await dialog.getByRole('alert').textContent()).toContain('服务器拒绝')
        await dialog.getByRole('button', { name: '取消', exact: true }).click()
        await page.getByLabel('模拟保存失败').selectOption('')
        await page.getByRole('button', { name: '删除', exact: true }).click()
        await page.getByRole('dialog', { name: '删除卡片', exact: true }).getByRole('button', { name: '确认删除', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent === 'deleteCard')
        expect(await data()).toEqual({ cardId: '33333333-3333-4333-8333-333333333333' })
        expect(await page.getByRole('dialog', { name: '删除卡片', exact: true }).isVisible()).toBe(false)
    })

    async function confirmCrop() {
        const dialog = page.getByRole('dialog', { name: /^裁剪/ })
        await dialog.waitFor()
        await dialog.getByRole('button', { name: '确认裁剪', exact: true }).click()
        await dialog.waitFor({ state: 'hidden' })
    }

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

    it.each(allCases.flatMap((item) => ['button', 'drop'].map((method) => ({ ...item, method }))))('crops and uploads real image bytes through $method and saves the returned URL in $kind', async ({ kind, field, add, action, method }) => {
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
        await confirmCrop()
        const [width, height] = kind === 'cards' ? [600, 800] : kind === 'achievements' ? [512, 512] : [960, 540]
        await page.waitForFunction((width) => document.querySelector<HTMLImageElement>('img[alt$="预览"]')?.naturalWidth === width, width)
        await page.getByRole('button', { name: add, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(uploaded!.subarray(0, 8)).toEqual(png.subarray(0, 8))
        expect(uploaded!.readUInt32BE(16)).toBe(width)
        expect(uploaded!.readUInt32BE(20)).toBe(height)
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
        expect((await data())[field]).toBe(imageUrl)
        if (kind === 'achievements') expect(await data()).toMatchObject({ conditionType: 'registration', conditionValue: 1 })
        await page.waitForFunction(() => !document.querySelector('[name=name]'))
        expect(await page.locator('img[alt$="预览"]').count()).toBe(0)
    })

    it.each(allCases)('retains the selected image after invalid or multiple drops in $kind and can still save it', async ({ kind, add, action }) => {
        await open(kind)
        await fill(kind)
        await page.locator('input[type=file]').setInputFiles({ name: 'original.png', mimeType: 'image/png', buffer: png })
        await confirmCrop()
        await drop([{ name: 'script.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }])
        expect(await page.getByRole('alert').textContent()).toContain('请选择不超过 5 MB')
        await drop([{ name: 'one.png', mimeType: 'image/png', buffer: png }, { name: 'two.png', mimeType: 'image/png', buffer: png }])
        expect(await page.getByRole('alert').textContent()).toContain('一次只能选择一张图片')
        const region = page.getByRole('region', { name: /文件区域$/ })
        expect(await region.textContent()).toContain('original-crop.png')
        expect(await page.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.files?.[0].name)).toBe('original-crop.png')
        await page.route('**/api/images/', (route) => route.fulfill({ status: 201, json: { url: imageUrl } }))
        await page.getByRole('button', { name: add, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
    })

    it.each(allCases)('cancels a replacement crop without changing the existing $kind image or form', async ({ kind, field }) => {
        await open(kind)
        await page.getByRole('link', { name: '返回列表', exact: true }).click()
        await page.getByRole('link', { name: '编辑', exact: true }).click()
        const previousUrl = await page.locator(`[name=${field}]`).inputValue()
        const previousName = await page.locator('[name=name]').inputValue()
        await drop()
        await page.getByRole('dialog', { name: /^裁剪/ }).waitFor()
        await page.getByRole('button', { name: '取消裁剪', exact: true }).click()
        expect(await page.locator(`[name=${field}]`).inputValue()).toBe(previousUrl)
        expect(await page.locator('[name=name]').inputValue()).toBe(previousName)
        expect(await page.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.files?.length)).toBe(0)
        expect(await page.locator('img[alt$="预览"]').getAttribute('src')).toBe(previousUrl)
    })

    it('exports the selected pixels at 600 × 800, supports zoom and keyboard panning, and preserves a confirmed crop on cancel', async () => {
        await open('cards')
        const source = Buffer.from(await page.evaluate(() => {
            const canvas = document.createElement('canvas')
            canvas.width = 300; canvas.height = 100
            const context = canvas.getContext('2d')!
            for (const [index, color] of ['#ff0000', '#00ff00', '#0000ff'].entries()) {
                context.fillStyle = color; context.fillRect(index * 100, 0, 100, 100)
            }
            return canvas.toDataURL('image/png').split(',')[1]
        }), 'base64')
        await page.locator('input[type=file]').setInputFiles({ name: 'color-bands.png', mimeType: 'image/png', buffer: source })
        await page.waitForFunction(() => document.querySelector('canvas[aria-label="裁剪预览"]')?.getAttribute('width') === '600')
        const centerPixel = () => page.getByRole('img', { name: '裁剪预览', exact: true }).evaluate((element: HTMLCanvasElement) => Array.from(element.getContext('2d')!.getImageData(300, 400, 1, 1).data))
        expect(await centerPixel()).toEqual([0, 255, 0, 255])
        const stage = page.getByRole('group', { name: '裁剪区域', exact: true })
        const bounds = (await stage.boundingBox())!
        await page.mouse.move(bounds.x + bounds.width * .2, bounds.y + bounds.height / 2)
        await page.mouse.down()
        await page.mouse.move(bounds.x + bounds.width * .95, bounds.y + bounds.height / 2, { steps: 8 })
        await page.mouse.up()
        await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('canvas[aria-label="裁剪预览"]')?.getContext('2d')?.getImageData(300, 400, 1, 1).data[0] === 255)
        expect(await centerPixel()).toEqual([255, 0, 0, 255])
        await page.getByRole('button', { name: '重置裁剪', exact: true }).click()
        await page.getByRole('slider', { name: '缩放', exact: true }).focus()
        await page.keyboard.press('End')
        expect(await page.getByRole('slider', { name: '缩放', exact: true }).inputValue()).toBe('4')
        await page.getByRole('group', { name: '裁剪区域', exact: true }).focus()
        for (let index = 0; index < 3; index += 1) await page.keyboard.press('Shift+ArrowLeft')
        await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>('canvas[aria-label="裁剪预览"]')?.getContext('2d')?.getImageData(300, 400, 1, 1).data[0] === 255)
        expect(await centerPixel()).toEqual([255, 0, 0, 255])
        await confirmCrop()
        const exported = await page.locator('input[type=file]').evaluate(async (element: HTMLInputElement) => {
            const file = element.files![0]
            const bitmap = await createImageBitmap(file)
            const canvas = document.createElement('canvas')
            canvas.width = bitmap.width; canvas.height = bitmap.height
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
            const result = { width: bitmap.width, height: bitmap.height, pixel: Array.from(canvas.getContext('2d')!.getImageData(300, 400, 1, 1).data), bytes: file.size }
            bitmap.close()
            return result
        })
        expect(exported).toMatchObject({ width: 600, height: 800, pixel: [255, 0, 0, 255] })
        await page.getByRole('button', { name: '调整裁剪', exact: true }).click()
        await page.getByRole('button', { name: '取消裁剪', exact: true }).click()
        expect(await page.locator('input[type=file]').evaluate((element: HTMLInputElement) => element.files![0].size)).toBe(exported.bytes)
    })

    it.each(allCases)('keeps the $kind crop dialog and its controls usable on a small screen', async ({ kind }) => {
        await open(kind)
        await page.setViewportSize({ width: 390, height: 820 })
        await drop()
        const dialog = page.getByRole('dialog', { name: /^裁剪/ })
        await dialog.waitFor()
        mkdirSync('tmp/admin-gamification-review', { recursive: true })
        for (const theme of ['light', 'dark']) {
            await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
            const bounds = (await page.getByRole('group', { name: '裁剪区域', exact: true }).boundingBox())!
            expect(bounds.x).toBeGreaterThanOrEqual(0)
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
            expect(bounds.width / bounds.height).toBeCloseTo(kind === 'cards' ? 3 / 4 : kind === 'redeems' ? 16 / 9 : 1, 2)
            await dialog.getByRole('button', { name: '确认裁剪', exact: true }).scrollIntoViewIfNeeded()
            await dialog.screenshot({ path: `tmp/admin-gamification-review/${kind}-${theme}-crop-mobile.png` })
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        }
        await confirmCrop()
    })

    it('shows the draw cost and a portrait card result using the same frame as the collection', async () => {
        await page.goto(new URL('/tests/fixtures/admin-gamification.html?kind=collection', origin).href)
        const draw = page.getByRole('button', { name: '抽一张卡 · 50 积分', exact: true })
        await draw.click()
        const dialog = page.getByRole('dialog', { name: '抽卡结果', exact: true })
        await dialog.waitFor()
        expect(await dialog.textContent()).toContain('本次消耗 50 积分')
        const frame = dialog.getByRole('img', { name: '校园纪念卡', exact: true }).locator('..')
        const bounds = (await frame.boundingBox())!
        expect(bounds.width / bounds.height).toBeCloseTo(3 / 4, 2)
        expect(await dialog.textContent()).toContain('拥有 3 张')
        await dialog.getByRole('button', { name: '收下卡片', exact: true }).click()
        expect(await page.getByRole('dialog', { name: '抽卡结果', exact: true }).count()).toBe(0)
        expect(await page.getByRole('dialog', { name: '抽卡结果', exact: true }).isVisible()).toBe(false)
    })

    it('requires card artwork and saves edits to rarity, series and draw weight', async () => {
        await open('cards')
        await fill('cards')
        await page.getByRole('button', { name: '添加卡片', exact: true }).click()
        await page.getByRole('alert').waitFor()
        expect(await page.getByRole('alert').textContent()).toContain('请选择卡面图片')
        await page.getByRole('link', { name: '返回列表', exact: true }).click()
        await page.getByRole('link', { name: '编辑', exact: true }).click()
        await page.locator('[name=rarity]').selectOption('legendary')
        await page.locator('[name=series]').fill('校园新系列')
        await page.locator('[name=dropRate]').fill('0')
        await page.getByRole('button', { name: '保存卡片', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent === 'updateCard')
        expect(await data()).toMatchObject({ rarity: 'legendary', series: '校园新系列', dropRate: 0, imageUrl: '/demo/card-rare.svg' })
        const frame = page.locator('#collectible-card img').locator('..')
        const bounds = await frame.boundingBox()
        expect(bounds!.width / bounds!.height).toBeCloseTo(3 / 4, 2)
        expect(await frame.locator('img').evaluate((image) => getComputedStyle(image).objectFit)).toBe('contain')
    })

    it.each(allCases)('preserves the $kind draft on upload failure and rejected or failed saves', async ({ kind, add }) => {
        await open(kind)
        await fill(kind)
        await page.locator('input[type=file]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png })
        await confirmCrop()
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
        await page.getByRole('link', { name: '返回列表', exact: true }).click()
        await page.getByRole('link', { name: '编辑', exact: true }).click()
        await page.locator('img[alt$="预览"]').waitFor()
        await page.getByRole('button', { name: '移除图片' }).click()
        expect(await page.locator(`[name=${field}]`).inputValue()).toBe('')
        await page.getByRole('button', { name: save, exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(update)
        expect((await data())[field]).toBeNull()
        await page.getByRole('link', { name: '编辑', exact: true }).click()
        await page.locator('[name=name]').fill('未保存草稿')
        await page.getByRole('link', { name: '取消', exact: true }).click()
        await page.getByRole('link', { name: /^新建/ }).click()
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

    it.each(allCases)('keeps $kind fields aligned and contained on desktop and mobile, in both themes', async ({ kind }) => {
        await open(kind)
        mkdirSync('tmp/admin-gamification-review', { recursive: true })
        if (kind === 'achievements') await page.locator('[name=conditionType]').selectOption('login_days')
        for (const theme of ['light', 'dark']) {
            await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
            for (const width of [1100, 851, 390]) {
                await page.setViewportSize({ width, height: 1000 })
                const fields = kind === 'cards' ? ['rarity', 'dropRate'] : kind === 'achievements' ? ['conditionType', 'conditionValue'] : ['type', 'status']
                const boxes = await Promise.all(fields.map((name) => page.locator(`[name=${name}]`).boundingBox()))
                expect(boxes.every((box) => box && box.width > 100)).toBe(true)
                if (width > 600) {
                    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThan(1)
                    expect(Math.abs(boxes[0]!.height - boxes[1]!.height)).toBeLessThan(1)
                }
                await drop([{ name: 'long-image-name-'.repeat(12) + '.png', mimeType: 'image/png', buffer: png }])
                await confirmCrop()
                await page.locator('img[alt$="预览"]').waitFor()
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
                await page.screenshot({ path: `tmp/admin-gamification-review/${kind}-${theme}-${width}.png`, fullPage: true })
            }
        }
    })

    it.each(allCases)('styles open $kind menus in both themes and retains native keyboard selection', async ({ kind }) => {
        await open(kind)
        const select = page.locator(kind === 'cards' ? '[name=rarity]' : kind === 'achievements' ? '[name=conditionType]' : '[name=status]')
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
            expect(await select.inputValue()).toBe(kind === 'cards' ? 'rare' : kind === 'achievements' ? 'login_days' : 'sold_out')
        }
        await select.focus()
        await page.keyboard.press('Space')
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        expect(await select.inputValue()).toBe(kind === 'cards' ? 'legendary' : kind === 'achievements' ? 'points_earned' : 'discontinued')
    })
})
