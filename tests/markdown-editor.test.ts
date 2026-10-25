import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
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

const content = '**实时更新**，行内 $y_1$。\n\n- 检查上下限\n- 检查微分\n\n$$\n\\frac{e-1}{2}\n$$'

describe.skipIf(!executablePath)('Markdown authoring pages in Chromium', () => {
    let server: ViteDevServer
    let browser: Browser
    let page: Page
    let origin: string
    let pageErrors: string[]

    beforeAll(async () => {
        const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
        server = await createServer({
            configFile: false,
            cacheDir: 'tmp/vite-markdown-editor-tests',
            plugins: [tailwindcss()],
            resolve: { alias: [
                { find: /^@\/components\/coeer$/, replacement: fixture('markdown-pages-ui.ts') },
                { find: /^~\/functions(?:\/mentions)?$/, replacement: fixture('markdown-pages-actions.ts') },
                { find: '@tanstack/react-router', replacement: fixture('markdown-pages-router.tsx') },
                { find: '@', replacement: fileURLToPath(new URL('../src/app', import.meta.url)) },
                { find: '@shared', replacement: fileURLToPath(new URL('../src/shared', import.meta.url)) },
            ] },
            server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
            optimizeDeps: { entries: ['tests/fixtures/markdown-pages.html'] },
        })
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
    }, 30000)
    beforeEach(async () => {
        pageErrors = []
        page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
        page.on('pageerror', (error) => pageErrors.push(error.message))
    })
    afterEach(async () => {
        await page?.close()
        expect(pageErrors).toEqual([])
    })
    afterAll(async () => { await browser?.close(); await server?.close() })

    async function open(kind: string) {
        await page.goto(new URL(`/tests/fixtures/markdown-pages.html?kind=${kind}`, origin).href)
        if (kind === 'bulletins' || kind === 'activities') await page.getByRole('link', { name: /^新建/ }).click()
        await page.locator('textarea').waitFor()
    }

    it('inserts a member selected with the keyboard and submits their stable mention ID', async () => {
        await open('createPost')
        const input = page.locator('textarea')
        await input.fill('@小')
        await page.getByRole('button', { name: /@小明/ }).waitFor()
        await input.press('Enter')
        expect(await input.inputValue()).toContain('[@小明](#mention-11111111-1111-4111-8111-111111111111)')
        expect(await page.getByRole('region', { name: '内容实时预览' }).getByText('@小明', { exact: true }).count()).toBe(1)
    })

    it('offers independent bulletin notification and pin controls', async () => {
        await open('bulletins')
        await page.locator('[name=notificationMode]').selectOption('banner')
        await page.locator('[name=isPinned]').check()
        expect(await page.locator('[name=notificationMode]').inputValue()).toBe('banner')
        expect(await page.locator('[name=isPinned]').isChecked()).toBe(true)
    })

    it('moves activity registrations into their scope and retains the activity type filter', async () => {
        await page.goto(new URL('/tests/fixtures/markdown-pages.html?kind=activities', origin).href)
        expect(await page.getByRole('button', { name: '报名情况', exact: true }).count()).toBe(1)
        await page.getByRole('button', { name: '报名情况', exact: true }).click()
        await page.getByRole('region', { name: '活动报名表' }).getByText('已报名', { exact: true }).waitFor()
        expect(await page.getByRole('cell', { name: '测试用户', exact: true }).count()).toBe(1)
        await page.getByRole('group', { name: '类型', exact: true }).getByRole('button', { name: '官方活动', exact: true }).click()
        expect(page.url()).toContain('scope=participants')
        expect(page.url()).toContain('type=official')
        await page.getByRole('button', { name: '全部活动', exact: true }).click()
        expect(await page.getByRole('region', { name: '活动报名表' }).count()).toBe(0)
    })

    it('persists bulletin pin and type filters and keeps the all-bulletins scope', async () => {
        await page.goto(new URL('/tests/fixtures/markdown-pages.html?kind=bulletins', origin).href)
        expect(await page.getByRole('button', { name: '全部公告', exact: true }).count()).toBe(1)
        await page.getByRole('group', { name: '置顶', exact: true }).getByRole('button', { name: '已置顶', exact: true }).click()
        await page.getByRole('group', { name: '类型', exact: true }).getByRole('button', { name: '群组公告', exact: true }).click()
        expect(page.url()).toContain('pinned=pinned')
        expect(page.url()).toContain('type=group_announcement')
        await page.reload()
        expect(await page.getByRole('button', { name: '已置顶', exact: true }).getAttribute('aria-pressed')).toBe('true')
        expect(await page.getByRole('button', { name: '群组公告', exact: true }).getAttribute('aria-pressed')).toBe('true')
    })

    it.each(['bulletins', 'activities'])('uses independent $kind create/edit routes and reloads existing Markdown', async kind => {
        await page.goto(new URL(`/tests/fixtures/markdown-pages.html?kind=${kind}`, origin).href)
        expect(await page.locator('.coeer-filter-panel > .coeer-tabs.coeer-scope-tabs.coeer-scrollbar').count()).toBe(1)
        expect(await page.locator('form:not([role=search])').count()).toBe(0)
        expect(await page.locator('.coeer-filter-toolbar .coeer-filter-group').count()).toBe(0)
        expect(await page.locator('.coeer-page-actions').getByRole('link', { name: /^新建/ }).getAttribute('href')).toContain(`/admin/${kind}/create`)
        const edit = page.getByRole('link', { name: '编辑', exact: true }).first()
        expect(await edit.getAttribute('href')).toMatch(new RegExp(`/admin/${kind}/[^/]+/edit`))
        await edit.click()
        await page.locator('textarea').waitFor()
        const original = await page.locator('textarea').inputValue()
        await page.locator('textarea').fill('未保存的内容')
        await page.reload()
        expect(await page.locator('textarea').inputValue()).toBe(original)
        expect(await page.locator('h1').textContent()).toMatch(/^编辑/)
        await page.getByRole('link', { name: '取消', exact: true }).click()
        await page.getByRole('link', { name: /^新建/ }).click()
        expect(await page.locator('textarea').inputValue()).toBe('')
        expect(await page.locator('h1').textContent()).toMatch(/^新建/)
    })

    it('reports forbidden characters live in titles and Markdown, blocks submission and preserves emoji', async () => {
        await open('createPost')
        const title = page.locator('[name="title"]')
        const body = page.locator('textarea[name="content"]')
        await title.fill('Hi\u200b')
        await body.fill('```js\n\ufeffcode\n```')
        await page.getByRole('alert').filter({ hasText: 'U+200B' }).waitFor()
        await page.getByRole('alert').filter({ hasText: 'U+FEFF' }).waitFor()
        expect(await title.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false)
        expect(await body.evaluate(el => (el as HTMLTextAreaElement).checkValidity())).toBe(false)
        await page.locator('button[type="submit"]').click()
        expect(await page.locator('#submitted-action').textContent()).toBe('')
        await title.fill('Hello 👩‍💻')
        await body.fill('می\u200cروم ❤️\n```js\nconst text = "\\u200B";\n```')
        expect(await body.evaluate(el => (el as HTMLTextAreaElement).checkValidity())).toBe(true)
        await page.locator('button[type="submit"]').click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent === 'createPost')
        const data = JSON.parse((await page.locator('#submitted-data').textContent())!)
        expect(data.title).toBe('Hello 👩‍💻')
        expect(data.content).toContain('می\u200cروم ❤️')
    })

    it('validates nickname whitespace and code-point length live without deleting input', async () => {
        await page.goto(`${origin}tests/fixtures/markdown-pages.html?kind=username`)
        const name = page.locator('[name="name"]')
        for (const value of ['a\u00a0b', ' a', 'a  b', 'a\u200b', '👩‍💻', '𠀀'.repeat(64)]) {
            await name.fill(value)
            await page.getByRole('alert').waitFor()
            expect(await name.inputValue()).toBe(value)
            expect(await name.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(false)
        }
        await name.fill('𠀀'.repeat(63))
        await page.waitForFunction(() => document.querySelector('[name="name"]')?.getAttribute('aria-invalid') === 'false')
        expect(await name.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(true)
        await name.fill('bad boy')
        expect(await name.evaluate(el => (el as HTMLInputElement).checkValidity())).toBe(true)
    })

    it.each([
        { kind: 'createPost', label: '内容', action: 'createPost', announcement: false },
        { kind: 'createPost', label: '内容', action: 'createPost', announcement: true },
        { kind: 'editPost', label: '内容', action: 'updatePost', announcement: false },
        { kind: 'feedback', label: '内容', action: 'createFeedback', announcement: false },
        { kind: 'bulletins', label: '内容', action: 'createBulletin', announcement: false },
        { kind: 'activities', label: '说明', action: 'createActivity', announcement: false },
    ])('previews and submits $kind (announcement=$announcement) with the original Markdown source', async ({ kind, label, action, announcement }) => {
        await open(kind)
        const input = page.getByRole('textbox', { name: label, exact: true })
        const preview = page.getByRole('region', { name: `${label}实时预览` })
        if (kind === 'editPost') {
            await preview.locator('.katex-display').waitFor()
            expect(await input.inputValue()).toContain('**已有正文**')
        }
        await input.fill(content)
        await preview.locator('.katex-display').waitFor()
        expect(await preview.locator('strong').textContent()).toBe('实时更新')
        expect(await preview.locator('li').count()).toBe(2)
        expect(await preview.locator('.katex').count()).toBe(2)
        await page.getByRole('textbox', { name: '标题', exact: true }).fill('测试发布')
        if (announcement) await page.locator('input[value="announcement"]').check()
        if (kind === 'feedback') await page.locator('select[name="targetType"]').selectOption('general')
        if (kind === 'activities') {
            await page.locator('[name="startTime"]').fill('2027-01-01T10:00')
            await page.locator('[name="endTime"]').fill('2027-01-01T12:00')
        }
        await page.locator('button[type="submit"]').click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
        const data = JSON.parse((await page.locator('#submitted-data').textContent())!)
        expect(data[kind === 'activities' ? 'description' : 'content']).toBe(content)
        if (announcement) expect(data.type).toBe('announcement')
        if (kind === 'bulletins' || kind === 'activities') {
            await page.waitForFunction(() => !document.querySelector('textarea'))
            await page.getByRole('link', { name: /^新建/ }).click()
            expect(await preview.locator('.katex').count()).toBe(0)
            expect(await page.getByRole('textbox', { name: '标题', exact: true }).inputValue()).toBe('')
        }
    })

    it.each([
        { kind: 'bulletins', first: '公告甲', second: '公告乙', save: '保存公告', action: 'updateBulletin' },
        { kind: 'activities', first: '活动甲', second: '活动乙', save: '保存活动', action: 'updateActivity' },
    ])('replaces the draft and preview when editing different $kind, cancelling or saving', async ({ kind, first, second, save, action }) => {
        await open(kind)
        const select = async (title: string) => {
            await page.getByRole('link', { name: '返回列表', exact: true }).click()
            await page.getByText(title, { exact: true }).locator('../..').getByRole('link', { name: '编辑', exact: true }).click()
        }
        const preview = page.getByRole('region')
        await select(first)
        await preview.locator('.katex-display').waitFor()
        expect(await page.locator('textarea').inputValue()).toContain('已有正文')
        await page.locator('textarea').fill('未保存的草稿 $w^2$')
        await select(second)
        await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('另一条正文'))
        expect(await preview.locator('strong').textContent()).toBe('另一条正文')
        expect(await preview.textContent()).not.toContain('未保存的草稿')
        await page.getByRole('link', { name: '取消', exact: true }).click()
        await page.getByRole('link', { name: /^新建/ }).click()
        expect(await page.locator('textarea').inputValue()).toBe('')
        expect(await preview.locator('.katex').count()).toBe(0)
        await select(first)
        await page.locator('textarea').fill(content)
        await page.getByRole('button', { name: save }).click()
        await page.waitForFunction(() => document.querySelector('#submitted-action')?.textContent !== '')
        expect(await page.locator('#submitted-action').textContent()).toBe(action)
        const data = JSON.parse((await page.locator('#submitted-data').textContent())!)
        expect(data.id).toBe(kind === 'bulletins' ? 'bulletin-a' : 'activity-a')
        expect(data[kind === 'bulletins' ? 'content' : 'description']).toBe(content)
        await page.waitForFunction(() => !document.querySelector('textarea'))
        expect(await preview.locator('.katex').count()).toBe(0)
    })

    it.each([
        { kind: 'bulletins', title: '公告甲', save: '保存公告' },
        { kind: 'activities', title: '活动甲', save: '保存活动' },
    ])('preserves the $kind draft and preview when the server rejects a save or the network fails', async ({ kind, title, save }) => {
        await open(kind)
        await page.getByRole('link', { name: '返回列表', exact: true }).click()
        await page.getByText(title, { exact: true }).locator('../..').getByRole('link', { name: '编辑', exact: true }).click()
        await page.locator('textarea').fill(content)
        for (const mode of ['response', 'network']) {
            await page.getByLabel('模拟提交失败').selectOption(mode)
            await page.getByRole('button', { name: save }).click()
            await page.getByRole('alert').waitFor()
            expect(await page.getByRole('alert').textContent()).toContain(mode === 'response' ? '服务器拒绝' : '网络中断')
            expect(await page.locator('textarea').inputValue()).toBe(content)
            expect(await page.getByRole('region').locator('strong').textContent()).toBe('实时更新')
            expect(await page.getByRole('region').locator('.katex').count()).toBe(2)
        }
        await page.getByRole('button', { name: save }).click()
        await page.waitForFunction(() => !document.querySelector('textarea'))
        expect(await page.getByRole('alert').count()).toBe(0)
    })

    it('keeps preview and textarea synchronized through native and cancelled form resets', async () => {
        await open('reset')
        const input = page.locator('textarea')
        const original = await input.inputValue()
        await input.fill(content)
        await page.locator('form').evaluate((form: HTMLFormElement) => {
            form.addEventListener('reset', (event) => event.preventDefault(), { once: true })
            form.reset()
        })
        expect(await input.inputValue()).toBe(content)
        expect(await page.getByRole('region').locator('strong').textContent()).toBe('实时更新')
        await page.getByRole('button', { name: '重置正文' }).click()
        expect(await input.inputValue()).toBe(original)
        expect(await page.getByRole('region').locator('strong').textContent()).toBe('已有正文')
    })

    it('fits editors to the available column and preserves mathematical layout on mobile and in dark mode', async () => {
        mkdirSync('tmp/markdown-editor-review', { recursive: true })
        for (const kind of ['createPost', 'editPost', 'feedback', 'bulletins', 'activities']) {
            await open(kind)
            await page.locator('textarea').fill(content + '\n\n```text\n' + 'unbroken-code-'.repeat(50) + '\n```')
            await page.getByRole('region').locator('.katex-display').waitFor()
            for (const width of [1100, 390]) {
                await page.setViewportSize({ width, height: 900 })
                const layout = await page.locator('.coeer-markdown-editor-layout').evaluate((element) => ({
                    columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
                    width: element.parentElement!.getBoundingClientRect().width,
                }))
                expect(layout.columns, `${kind} at ${width}px`).toBe(layout.width >= 720 ? 2 : 1)
                if (kind === 'feedback') expect(layout.columns).toBe(1)
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
                await page.screenshot({ path: `tmp/markdown-editor-review/${kind}-${width}.png`, fullPage: true })
            }
            await page.evaluate(() => document.documentElement.classList.add('dark'))
            expect(await page.getByRole('region').locator('.katex').count()).toBe(2)
            await page.screenshot({ path: `tmp/markdown-editor-review/${kind}-dark.png`, fullPage: true })
        }
    })

    it('renders formulas and Markdown in announcement, activity and feedback summaries without nested links', async () => {
        await page.goto(new URL('/tests/fixtures/markdown-pages.html?kind=summaries', origin).href)
        await page.locator('#feedback-row .katex-display').waitFor()
        for (const id of ['bulletin-card', 'activity-card', 'feedback-card', 'feedback-row']) {
            const card = page.locator(`#${id}`)
            expect(await card.locator('strong').textContent()).toBe('公式摘要')
            expect(await card.locator('.katex').count()).toBe(2)
            expect(await card.locator('.coeer-markdown-summary a').count()).toBe(0)
            expect(await card.locator('a a').count()).toBe(0)
            expect(await card.textContent()).not.toContain('**')
        }
        await page.setViewportSize({ width: 390, height: 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    })
})
