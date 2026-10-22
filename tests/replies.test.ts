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

describe.skipIf(!executablePath)('reply previews and nested discussions in Chromium', () => {
    let server: ViteDevServer
    let browser: Browser
    let page: Page
    let origin: string
    let pageErrors: string[]

    beforeAll(async () => {
        const actions = fileURLToPath(new URL('./fixtures/reply-actions.ts', import.meta.url))
        server = await createServer({
            configFile: false,
            cacheDir: 'tmp/vite-reply-tests',
            plugins: [tailwindcss()],
            resolve: { alias: [
                { find: '~/functions/replies', replacement: actions },
                { find: '@tanstack/react-router', replacement: actions },
            ] },
            server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [process.cwd(), realpathSync('node_modules')] } },
            optimizeDeps: { entries: ['tests/fixtures/replies.html'] },
        })
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
    }, 30000)
    beforeEach(async () => {
        pageErrors = []
        page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
        page.on('pageerror', (error) => pageErrors.push(error.message))
        await page.goto(new URL('/tests/fixtures/replies.html', origin).href)
        await page.locator('#group-reply-content').waitFor()
    })
    afterEach(async () => {
        await page?.close()
        expect(pageErrors).toEqual([])
    })
    afterAll(async () => { await browser?.close(); await server?.close() })

    async function expand(id: string, child: string) {
        await page.locator(`#reply-${id}`).getByRole('button', { name: /^展开/ }).click()
        await page.locator(`#reply-${child}`).waitFor()
    }

    it('updates Markdown and inline/display math while typing, including edits and incomplete formulas', async () => {
        const input = page.locator('#group-reply-content')
        const preview = page.getByRole('region', { name: '回复实时预览' })
        await input.fill('**实时加粗**\n\n- 检查上下限\n- 检查微分\n\n行内 $x^2$\n\n$$\n\\frac{1}{2}\n$$')
        await preview.locator('.katex-display').waitFor()
        expect(await preview.locator('strong').textContent()).toBe('实时加粗')
        expect(await preview.locator('li').count()).toBe(2)
        expect(await preview.locator('.katex').count()).toBe(2)
        await input.fill(String.raw`未完成 $\frac{1}{$`)
        await preview.locator('.katex-error').waitFor()
        await input.fill('更改 $y_1$')
        await page.waitForFunction(() => document.querySelector('[aria-label="回复实时预览"] annotation')?.textContent === 'y_1')
        await expand('root', 'level-1')
        await page.locator('#reply-level-1').getByRole('button', { name: '编辑', exact: true }).click()
        expect(await input.inputValue()).toContain('$x_1^2$')
        expect(await input.evaluate((element) => document.activeElement === element)).toBe(true)
        await page.getByRole('button', { name: '取消', exact: true }).click()
        expect(await input.inputValue()).toBe('')
        expect(await preview.locator('.katex').count()).toBe(0)
        expect(await page.getByRole('button', { name: '发送回复' }).isDisabled()).toBe(true)
    })

    it('creates, edits and deletes nested replies while retaining descendants and their context', async () => {
        await expand('root', 'level-1')
        await expand('level-1', 'level-2')
        await page.locator('#reply-level-1').getByRole('button', { name: '回复', exact: true }).click()
        await page.locator('#group-reply-content').fill('**新增第三级** $z^2$')
        await page.getByRole('button', { name: '发送回复' }).click()
        await page.locator('#reply-new-1 strong').waitFor()
        expect(await page.locator('#last-parent').textContent()).toBe('level-1')
        expect(await page.locator('#reply-new-1').getAttribute('data-depth')).toBe('2')
        expect(await page.locator('#reply-new-1 a').textContent()).toContain('回复 同学乙')
        await page.locator('#reply-new-1').getByRole('button', { name: '编辑', exact: true }).click()
        await page.locator('#group-reply-content').fill('修改后的第三级 $z^3$')
        await page.getByRole('button', { name: '保存修改' }).click()
        await page.waitForFunction(() => document.querySelector('#reply-new-1 .coeer-markdown')?.textContent?.includes('修改后的第三级'))
        await page.locator('#reply-level-1').getByRole('button', { name: '删除', exact: true }).click()
        await page.waitForFunction(() => document.querySelector('#reply-level-1')?.textContent?.includes('该回复已删除'))
        expect(await page.locator('#reply-level-1').textContent()).not.toContain('同学乙')
        expect(await page.locator('#reply-new-1').isVisible()).toBe(true)
        expect(await page.locator('#reply-new-1 a').textContent()).toContain('已删除的回复')
        await page.locator('#group-reply-content').fill('新的顶层讨论')
        await page.getByRole('button', { name: '发送回复' }).click()
        await page.locator('#reply-new-2').waitFor()
        expect(await page.locator('#reply-new-2').getAttribute('data-depth')).toBe('0')
        expect(await page.locator('#root-created').textContent()).toBe('true')
    })

    it('retries failed child loads and loads more siblings without dropping or duplicating replies', async () => {
        await page.getByRole('button', { name: '模拟下次加载失败' }).click()
        await page.locator('#reply-many').getByRole('button', { name: /^展开/ }).click()
        await page.getByRole('alert').waitFor()
        expect(await page.getByRole('alert').textContent()).toContain('模拟网络中断')
        await page.getByRole('button', { name: '重试加载' }).click()
        await page.locator('#reply-sibling-19').waitFor()
        expect(await page.locator('#reply-children-many article').count()).toBe(20)
        await page.getByRole('button', { name: '加载更多子回复' }).click()
        await page.locator('#reply-sibling-24').waitFor()
        expect(await page.locator('#reply-children-many article').count()).toBe(25)
        expect(await page.getByRole('button', { name: '加载更多子回复' }).count()).toBe(0)
        await page.locator('#reply-many').getByRole('button', { name: '收起子回复' }).click()
        expect(await page.locator('#reply-sibling-0').isVisible()).toBe(false)
        await expand('many', 'sibling-24')
        expect(await page.locator('#reply-children-many article').count()).toBe(25)
    })

    it('displays newer roots and siblings above older replies, including newly submitted replies', async () => {
        // Deliberately supply unsorted rows to verify the rendered order independently of the API fixture.
        await page.getByRole('button', { name: '模拟乱序回复' }).click()
        await page.waitForFunction(() => document.querySelector('ol[aria-label="群内回复"] > li > article')?.id === 'reply-many')
        await expand('many', 'sibling-1')
        const children = page.locator('#reply-children-many > ol > li > article')
        expect((await children.evaluateAll((items) => items.map((item) => item.id))).slice(0, 3))
            .toEqual(['reply-sibling-1', 'reply-sibling-2', 'reply-sibling-0'])
        await page.getByRole('button', { name: '加载更多子回复' }).click()
        await page.waitForFunction(() => document.querySelectorAll('#reply-children-many > ol > li > article').length === 25)
        const dates = await children.locator('time').evaluateAll((items) => items.map((item) => new Date(item.getAttribute('datetime')!).getTime()))
        expect(dates.every((date, index) => index === 0 || dates[index - 1] >= date)).toBe(true)
        await page.locator('#group-reply-content').fill('按发布时间置顶的新回复')
        await page.getByRole('button', { name: '发送回复' }).click()
        await page.waitForFunction(() => document.querySelector('ol[aria-label="群内回复"] > li > article')?.id === 'reply-new-1')
    })

    it('shows deep hierarchy on desktop and mobile without shrinking the reply body indefinitely', async () => {
        await expand('root', 'level-1')
        for (let depth = 1; depth < 7; depth++) await expand(`level-${depth}`, `level-${depth + 1}`)
        await page.locator('#group-reply-content').fill('## 实时推导\n\n**换元**，令 $u=x^2$。\n\n$$\n\\int_0^1 x e^{x^2}\\,dx = \\frac{e-1}{2}\n$$')
        await page.getByRole('region', { name: '回复实时预览' }).locator('.katex-display').waitFor()
        mkdirSync('tmp/reply-review', { recursive: true })
        for (const width of [1100, 390]) {
            await page.setViewportSize({ width, height: 900 })
            const bounds = await page.locator('main').evaluate((element) => {
                const left = (id: string) => element.querySelector(`#reply-${id}`)!.getBoundingClientRect().left
                return { root: left('root'), child: left('level-1'), grandchild: left('level-2'), fourth: left('level-3'), deepest: left('level-7') }
            })
            expect(bounds.child).toBeGreaterThan(bounds.root)
            expect(bounds.grandchild).toBeGreaterThan(bounds.child)
            expect(bounds.deepest).toBe(bounds.fourth)
            expect(await page.locator('#reply-level-7').textContent()).toContain('第 8 级')
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
            await page.screenshot({ path: `tmp/reply-review/${width}.png`, fullPage: true })
        }
        await page.evaluate(() => document.documentElement.classList.add('dark'))
        await page.screenshot({ path: 'tmp/reply-review/mobile-dark.png', fullPage: true })
    })
})
