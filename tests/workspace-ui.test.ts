import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { chromium, type Browser, type Page } from 'playwright-core'
import { createServer, type ViteDevServer } from 'vite'
import { workspacePreviewConfig } from './support/workspace-preview'

const executablePath = [process.env.COEER_TEST_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((path): path is string => !!path && existsSync(path))
const screens = ['home', 'guest', 'feedbacks', 'detail', 'profile', 'spaces', 'slots', 'bookings', 'booking', 'admin', 'groups', 'components', 'auth']
const layouts = [{ width: 1440, theme: 'light' }, { width: 1440, theme: 'dark' }, { width: 390, theme: 'light' }, { width: 390, theme: 'dark' }]

describe.skipIf(!executablePath)('workspace surfaces and interaction in Chromium', () => {
    let server: ViteDevServer, browser: Browser, page: Page, origin: string
    let errors: string[]
    beforeAll(async () => {
        server = await createServer(workspacePreviewConfig())
        await server.listen()
        origin = server.resolvedUrls!.local[0]
        browser = await chromium.launch({ executablePath, headless: true })
        mkdirSync('tmp/glass-review', { recursive: true })
    }, 30000)
    beforeEach(async () => {
        errors = []
        page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
        page.on('pageerror', error => errors.push(error.message))
    })
    afterEach(async () => { await page?.close(); expect(errors).toEqual([]) })
    afterAll(async () => { await browser?.close(); await server?.close() })
    async function open(screen: string, theme = 'light', state = 'normal', effects = '') {
        await page.goto(new URL(`tests/fixtures/workspace.html?screen=${screen}&theme=${theme}&state=${state}&effects=${effects}`, origin).href)
        await page.locator('h1').waitFor()
        await page.waitForFunction(() => getComputedStyle(document.body).fontSize === '14px')
    }

    it.each(['groups', 'feedbacks', 'bulletins', 'activities', 'bookmarks', 'redeems', 'admin', 'adminGroups'])('composes %s as header, scope, toolbar, filter groups and content at both widths', async screen => {
        await open(screen)
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 960 })
            const structure = await page.locator('h1').evaluate(heading => {
                const header = heading.closest('.coeer-page-header')!
                const container = header.parentElement!
                const panel = header.nextElementSibling!
                const scope = panel.querySelector(':scope > .coeer-scope-tabs')!
                const toolbar = panel.querySelector(':scope > .coeer-filter-toolbar')!
                const groups = panel.querySelector(':scope > .coeer-filter-groups')!
                return {
                    page: container.classList.contains('coeer-page'),
                    first: container.firstElementChild === header,
                    panel: panel.classList.contains('coeer-filter-panel'),
                    ordered: scope.nextElementSibling === toolbar && toolbar.nextElementSibling === groups,
                    nestedOptions: toolbar.querySelector('.coeer-filter-options') !== null,
                    content: !!panel.nextElementSibling,
                    overflow: document.documentElement.scrollWidth > innerWidth,
                }
            })
            expect(structure).toEqual({ page: true, first: true, panel: true, ordered: true, nestedOptions: false, content: true, overflow: false })
        }
    })
    it('omits unused layout regions and keeps the space header before its filters', async () => {
        await open('profile')
        expect(await page.locator('.coeer-filter-panel').count()).toBe(0)
        expect(await page.locator('.coeer-page-header > .coeer-page-actions').count()).toBe(1)
        await open('notifications')
        await page.getByRole('button', { name: '未读', exact: true }).click()
        expect(await page.getByRole('button', { name: '未读', exact: true }).getAttribute('aria-pressed')).toBe('true')
        expect(await page.locator('.coeer-filter-panel .coeer-filter-toolbar, .coeer-filter-panel .coeer-filter-groups').count()).toBe(0)
        await open('spaces')
        const header = await page.locator('.coeer-page-header').boundingBox()
        const filters = await page.locator('.coeer-filter-panel').boundingBox()
        expect(header!.y + header!.height).toBeLessThan(filters!.y)
    })

    it('opens reviews in StrictMode, preserves saved fields, and separates reviewed feedback from the queue', async () => {
        await open('admin')
        const rows = page.locator('table.table-fixed > tbody > tr')
        expect(await rows.count()).toBe(3)
        expect(await rows.getByRole('button', { name: '审核', exact: true }).count()).toBe(0)
        for (const [index, status] of ['processing', 'resolved', 'invalid'].entries()) {
            const row = rows.nth(index)
            expect(await row.getByText(index % 2 ? '公开' : '非公开', { exact: true }).count()).toBe(1)
            await row.getByRole('button', { name: '编辑', exact: true }).click()
            const dialog = page.getByRole('dialog', { name: '编辑反馈' })
            await dialog.waitFor()
            expect(await dialog.locator('[name=status]').inputValue()).toBe(status)
            expect(await dialog.locator('[name=isPublic]').inputValue()).toBe(String(index % 2 === 1))
            await dialog.getByRole('button', { name: '取消', exact: true }).click()
        }
        await page.getByRole('button', { name: '审核队列', exact: true }).click()
        expect(await rows.count()).toBe(1)
        expect(await rows.getByRole('button', { name: '编辑', exact: true }).count()).toBe(0)
        await rows.getByRole('button', { name: '审核', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: '审核反馈' })
        await dialog.waitFor()
        expect(await dialog.locator('[name=status]').inputValue()).toBe('pending')
        await dialog.locator('[name=status]').selectOption('resolved')
        await dialog.locator('[name=isPublic]').selectOption('false')
        await dialog.locator('[name=note]').fill('审核备注保留')
        await page.evaluate(() => { (window as any).__feedbackFail = true })
        await dialog.getByRole('button', { name: '保存', exact: true }).click()
        await dialog.getByRole('alert').waitFor()
        expect(await dialog.locator('[name=note]').inputValue()).toBe('审核备注保留')
        expect(await dialog.locator('[name=status]').inputValue()).toBe('resolved')
        await page.evaluate(() => { (window as any).__feedbackFail = false })
        await dialog.getByRole('button', { name: '保存', exact: true }).click()
        await dialog.waitFor({ state: 'hidden' })
        expect(await rows.count()).toBe(0)
        await page.getByRole('button', { name: '已审核反馈', exact: true }).click()
        expect(await rows.count()).toBe(4)
        const reviewed = rows.first()
        expect(await reviewed.getByText('已解决', { exact: true }).count()).toBe(1)
        expect(await reviewed.getByText('非公开', { exact: true }).count()).toBe(1)
        await reviewed.getByRole('button', { name: '编辑', exact: true }).click()
        await page.getByRole('dialog').locator('[name=status]').selectOption('pending')
        await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click()
        await page.getByRole('dialog').waitFor({ state: 'hidden' })
        expect(await rows.count()).toBe(3)
        await page.getByRole('button', { name: '审核队列', exact: true }).click()
        page.once('dialog', dialog => void dialog.accept())
        await rows.getByRole('button', { name: '删除', exact: true }).click()
        await rows.waitFor({ state: 'hidden' })
    })

    it('separates group moderation scopes and preserves edits through failures and status changes', async () => {
        await open('adminGroups')
        const rows = page.locator('table.coeer-data-table > tbody > tr')
        expect(await rows.count()).toBe(1)
        expect(await rows.getByRole('button', { name: '审核', exact: true }).count()).toBe(0)
        await rows.getByRole('button', { name: '编辑', exact: true }).click()
        await page.getByRole('dialog', { name: '编辑群组' }).waitFor()
        expect(await page.getByRole('dialog').locator('[name=status]').inputValue()).toBe('approved')
        await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
        await page.getByRole('button', { name: '审核队列', exact: true }).click()
        expect(await rows.count()).toBe(1)
        expect(await rows.getByRole('button', { name: '编辑', exact: true }).count()).toBe(0)
        await rows.getByRole('button', { name: '审核', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: '审核群组' })
        await dialog.waitFor()
        expect(await dialog.locator('[name=status]').inputValue()).toBe('pending')
        expect(await dialog.locator('[name=reviewNote]').inputValue()).toBe('原有备注')
        await dialog.locator('[name=status]').selectOption('rejected')
        await dialog.locator('[name=reviewNote]').fill('补充信息后重审')
        await page.evaluate(() => { (window as any).__groupFail = true })
        await dialog.getByRole('button', { name: '保存', exact: true }).click()
        await dialog.getByRole('alert').waitFor()
        expect(await dialog.locator('[name=reviewNote]').inputValue()).toBe('补充信息后重审')
        await page.evaluate(() => { (window as any).__groupFail = false })
        await dialog.getByRole('button', { name: '保存', exact: true }).click()
        await dialog.waitFor({ state: 'hidden' })
        expect(await rows.count()).toBe(0)
        await page.getByRole('button', { name: '已审核群组', exact: true }).click()
        expect(await rows.count()).toBe(2)
        await rows.last().getByRole('button', { name: '编辑', exact: true }).click()
        const editor = page.getByRole('dialog', { name: '编辑群组' })
        expect(await editor.locator('[name=status]').inputValue()).toBe('rejected')
        expect(await editor.locator('[name=reviewNote]').inputValue()).toBe('补充信息后重审')
        await editor.locator('[name=status]').selectOption('pending')
        await editor.getByRole('button', { name: '保存', exact: true }).click()
        await editor.waitFor({ state: 'hidden' })
        expect(await rows.count()).toBe(1)
        await page.getByRole('button', { name: '审核队列', exact: true }).click()
        page.once('dialog', dialog => void dialog.accept())
        await rows.getByRole('button', { name: '删除', exact: true }).click()
        await rows.waitFor({ state: 'hidden' })
    })

    it('keeps an initially open modal visible across StrictMode effect replay', async () => {
        await open('components', 'light', 'initialOpen')
        const dialog = page.getByRole('dialog', { name: '测试弹窗' })
        await dialog.waitFor()
        await page.waitForTimeout(100)
        expect(await dialog.isVisible()).toBe(true)
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
    })
    it.each(['adminGroups', 'adminBookings', 'adminAllowlist', 'adminCatalog'])('keeps the %s status table contained and its management action usable on mobile', async screen => {
        await page.setViewportSize({ width: 390, height: 960 })
        await open(screen)
        const table = page.locator('table.coeer-data-table')
        await table.waitFor()
        expect((await layout()).overflow).toBeLessThanOrEqual(1)
        expect(await page.locator('.coeer-table-scroll').getAttribute('tabindex')).toBe('0')
        const action = screen === 'adminBookings' ? '查看处理' : '编辑'
        await table.getByRole('button', { name: action, exact: true }).click()
        if (screen === 'adminAllowlist') {
            expect(await page.getByLabel('学号', { exact: true }).inputValue()).toBe('2026201234')
            expect(await page.locator('form select').inputValue()).toBe('review')
        } else {
            const dialog = page.getByRole('dialog').last()
            await dialog.waitFor()
            if (screen === 'adminBookings') {
                await dialog.getByRole('button', { name: '审核通过', exact: true }).click()
                await dialog.getByRole('alert').filter({ hasText: 'writes are disabled' }).waitFor()
            }
            await dialog.getByRole('button', { name: '关闭弹窗', exact: true }).click()
            await dialog.waitFor({ state: 'hidden' })
        }
    })

    it('shows a disabled applied state when entering a group with a pending application', async () => {
        await page.goto(new URL('tests/fixtures/workspace.html?screen=groupPending', origin).href)
        await page.getByRole('button', { name: '已申请', exact: true }).waitFor()
        expect(await page.getByRole('button', { name: '已申请', exact: true }).isDisabled()).toBe(true)
        expect(await page.getByRole('button', { name: '申请加入', exact: true }).count()).toBe(0)
        await page.reload()
        expect(await page.getByRole('button', { name: '已申请', exact: true }).isDisabled()).toBe(true)
        await page.goto(new URL('tests/fixtures/workspace.html?screen=groupMember', origin).href)
        expect(await page.getByRole('button', { name: '申请加入', exact: true }).count()).toBe(0)
    })
    async function layout() {
        return page.evaluate(() => {
            const workspace = document.querySelector('.coeer-workspace')?.getBoundingClientRect()
            const visible = (element: Element) => {
                const rect = element.getBoundingClientRect()
                return !!element.getClientRects().length && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth
            }
            const blur = [...document.querySelectorAll('*')].filter(element => visible(element) && getComputedStyle(element).backdropFilter !== 'none')
            return { overflow: document.documentElement.scrollWidth - innerWidth, mainRight: workspace?.right, mainLeft: workspace?.left, clientWidth: document.body.getBoundingClientRect().right, blur: blur.map(element => ({ value: getComputedStyle(element).backdropFilter, role: element.className })) }
        })
    }
    it.each(screens.flatMap(screen => layouts.map(item => ({ screen, ...item }))))('keeps $screen readable and within the $width px $theme viewport', async ({ screen, width, theme }) => {
        await page.setViewportSize({ width, height: 960 })
        await open(screen, theme)
        const result = await layout()
        expect(result.overflow).toBeLessThanOrEqual(1)
        if (result.mainRight !== undefined) {
            expect(Math.abs(result.clientWidth - result.mainRight - (width < 640 ? 16 : 32))).toBeLessThanOrEqual(1)
            expect(result.mainLeft).toBe(width >= 1024 ? 256 : 16)
        }
        expect(result.blur.length).toBeLessThanOrEqual(width < 640 ? 1 : 2)
        expect(result.blur.length).toBe(screen === 'auth' ? 0 : screen === 'guest' || width < 640 ? 1 : 2)
        for (const item of result.blur) expect(item.value).toBe(width < 640 ? 'blur(8px)' : 'blur(16px)')
        if (screen === 'home' || screen === 'profile' || screen === 'admin') await page.screenshot({ path: `tmp/glass-review/${screen}-${width}-${theme}.png`, fullPage: true })
    })
    it.each([
        ['home', 'long'], ['home', 'empty'], ['feedbacks', 'empty'], ['detail', 'long'], ['profile', 'long'], ['profile', 'empty'],
        ['spaces', 'loading'], ['spaces', 'error'], ['spaces', 'empty'], ['slots', 'long'], ['bookings', 'long'], ['booking', 'pending'], ['admin', 'empty'], ['auth', 'error'],
    ].flatMap(([screen, state]) => [320, 1920].map(width => ({ screen, state, width }))))('reflows $screen / $state at $width px', async ({ screen, state, width }) => {
        await page.setViewportSize({ width, height: 900 })
        if (state === 'loading') {
            await page.goto(new URL(`tests/fixtures/workspace.html?screen=${screen}&state=${state}`, origin).href)
            await page.getByRole('status').first().waitFor()
        } else await open(screen, 'dark', state)
        expect((await layout()).overflow).toBeLessThanOrEqual(1)
    })
    it('uses opaque readable inputs and state badges, keeping the unlocked and locked text equally legible', async () => {
        await open('components', 'dark')
        const values = await page.evaluate(() => {
            const field = document.querySelector('input')!, badge = [...document.querySelectorAll('span')].find(element => element.textContent === 'success')!
            const color = (value: string) => value.match(/[\d.]+/g)!.map(Number).slice(0, 3).map(v => v / 255)
            const lum = (rgb: number[]) => rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
            const contrast = (a: string, b: string) => { const x = lum(color(a)), y = lum(color(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
            const input = getComputedStyle(field), status = getComputedStyle(badge)
            return { inputBg: input.backgroundColor, inputContrast: contrast(input.color, input.backgroundColor), borderContrast: contrast(input.borderColor, input.backgroundColor), badgeBg: status.backgroundColor, badgeContrast: contrast(status.color, status.backgroundColor), lockedOpacity: getComputedStyle(document.querySelector('.coeer-card:has(h3)')!).opacity }
        })
        expect(values.inputBg.startsWith('rgb(')).toBe(true)
        expect(values.badgeBg.startsWith('rgb(')).toBe(true)
        expect(values.inputContrast).toBeGreaterThanOrEqual(4.5)
        expect(values.borderContrast).toBeGreaterThanOrEqual(3)
        expect(values.badgeContrast).toBeGreaterThanOrEqual(4.5)
        expect(values.lockedOpacity).toBe('1')
    })
    it('keeps mobile controls at least 44px and fields at least 16px', async () => {
        await page.setViewportSize({ width: 390, height: 844 })
        await open('components')
        const values = await page.locator('.coeer-button, .coeer-field').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({ height: element.getBoundingClientRect().height, size: parseFloat(getComputedStyle(element).fontSize), field: element.classList.contains('coeer-field') })))
        for (const value of values) { expect(value.height).toBeGreaterThanOrEqual(44); if (value.field) expect(value.size).toBeGreaterThanOrEqual(16) }
    })
    it('moves from the mobile drawer to keyboard search without leaving a second modal or scroll lock', async () => {
        await page.setViewportSize({ width: 390, height: 844 })
        await open('home')
        await page.getByRole('button', { name: '打开导航', exact: true }).click()
        await page.getByRole('dialog', { name: '主导航', exact: true }).waitFor()
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden')
        await page.getByRole('dialog').getByRole('button', { name: '搜索页面', exact: true }).click()
        await page.getByRole('combobox').waitFor()
        expect(await page.locator('dialog[open]').count()).toBe(1)
        await page.getByRole('combobox').fill('个人中心')
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        await page.waitForFunction(() => !document.querySelector('dialog[open]'))
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
        expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('搜索页面')
    })
    it('contains focus, ignores inner padding clicks, restores focus and displays persistent errors inside the active modal', async () => {
        await open('components')
        await page.getByRole('button', { name: '打开测试弹窗', exact: true }).click()
        const dialog = page.getByRole('dialog', { name: '测试弹窗', exact: true })
        await dialog.waitFor()
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => document.querySelector('dialog[open]')?.contains(document.activeElement))).toBe(true)
        const box = (await dialog.boundingBox())!
        await page.mouse.click(box.x + 5, box.y + 5)
        expect(await dialog.isVisible()).toBe(true)
        await dialog.getByRole('button', { name: '显示弹窗错误', exact: true }).click()
        await dialog.getByRole('alert').waitFor()
        expect((await layout()).blur.length).toBe(1)
        await page.clock.install()
        await page.clock.fastForward(6000)
        expect(await dialog.getByRole('alert').isVisible()).toBe(true)
        await dialog.getByRole('button', { name: '模拟提交锁定', exact: true }).click()
        await page.keyboard.press('Escape')
        expect(await dialog.isVisible()).toBe(true)
        await dialog.getByRole('button', { name: '解除提交锁定', exact: true }).click()
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.querySelector('dialog[open]'))
        expect(await page.getByRole('button', { name: '打开测试弹窗', exact: true }).evaluate(element => element === document.activeElement)).toBe(true)
        expect(await page.evaluate(() => document.body.style.overflow)).toBe('')
    })
    it('pauses success notices on hover and exposes a close control', async () => {
        await page.clock.install()
        await open('components')
        await page.getByRole('button', { name: '显示成功通知', exact: true }).click()
        const notice = page.locator('.coeer-toast')
        await notice.waitFor()
        await notice.hover()
        await page.clock.fastForward(6000)
        expect(await notice.isVisible()).toBe(true)
        await page.getByRole('button', { name: '关闭通知：已保存', exact: true }).click()
        expect(await notice.count()).toBe(0)
    })
    it('falls back to opaque surfaces without backdrop support and under contrast/motion preferences', async () => {
        await open('home', 'dark')
        await page.evaluate(() => {
            function removeSupports(sheet: CSSStyleSheet | CSSGroupingRule) {
                for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
                    const rule = sheet.cssRules[index]
                    if (rule instanceof CSSSupportsRule && rule.conditionText.includes('backdrop-filter')) sheet.deleteRule(index)
                    else if (rule instanceof CSSGroupingRule) removeSupports(rule)
                }
            }
            for (const sheet of document.styleSheets) removeSupports(sheet)
        })
        expect((await layout()).blur).toEqual([])
        expect(await page.locator('header').evaluate(element => getComputedStyle(element).backgroundColor.startsWith('rgb('))).toBe(true)
        await page.emulateMedia({ contrast: 'more', reducedMotion: 'reduce' })
        await open('home', 'dark')
        expect((await layout()).blur).toEqual([])
        expect(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)).toBe('none')
        await page.emulateMedia({ forcedColors: 'active' })
        expect((await layout()).blur).toEqual([])
        await page.emulateMedia({ forcedColors: 'none', media: 'print' })
        expect(await page.locator('p.text-muted-foreground').first().evaluate(element => getComputedStyle(element).color)).toBe('rgb(51, 51, 51)')
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(255, 255, 255)')
    })
    it('keeps the explicit solid mode usable and records browser evidence', async () => {
        await open('home', 'light', 'normal', 'solid')
        expect((await layout()).blur).toEqual([])
        expect(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)).toBe('none')
        writeFileSync('tmp/glass-review/browser.json', JSON.stringify({ browser: browser.version(), mode: 'isolated real React pages with UI fixture data; no backend writes', layouts, screens }, null, 2))
    })
    it.each(layouts)('keeps guest glass visible after scrolling at $width px in $theme', async ({ width, theme }) => {
        await page.setViewportSize({ width, height: 844 })
        await open('guest', theme, 'long')
        await page.evaluate(() => scrollTo(0, 180))
        const result = await page.locator('header').evaluate(header => {
            const style = getComputedStyle(header), canvas = getComputedStyle(document.body, '::before')
            const rgba = style.backgroundColor.match(/[\d.]+/g)!.map(Number)
            const alpha = rgba[3] ?? 1
            const worst = rgba.slice(0, 3).map(value => value * alpha + (document.documentElement.classList.contains('dark') ? 255 : 0) * (1 - alpha))
            const text = getComputedStyle(header.querySelector('.text-muted-foreground')!).color.match(/[\d.]+/g)!.map(Number).slice(0, 3)
            const luminance = (rgb: number[]) => rgb.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
            const a = luminance(text), b = luminance(worst)
            return { top: header.getBoundingClientRect().top, alpha, blur: style.backdropFilter, canvasPosition: canvas.position, canvasImage: canvas.backgroundImage, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
        })
        expect(result.top).toBe(0)
        expect(result.alpha).toBeLessThan(width < 640 ? .9 : .75)
        expect(result.blur).toBe(width < 640 ? 'blur(8px)' : 'blur(16px)')
        expect(result.canvasPosition).toBe('fixed')
        expect(result.canvasImage).toContain('radial-gradient')
        expect(result.contrast).toBeGreaterThanOrEqual(4.5)
        await page.screenshot({ path: `tmp/glass-review/guest-scrolled-${width}-${theme}.png` })
    })
})
