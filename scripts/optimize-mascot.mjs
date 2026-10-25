import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const sourcePath = process.argv[2]
if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error('Usage: node scripts/optimize-mascot.mjs <source.png> (provide an existing PNG)')
}
const executablePath = [process.env.COEER_TEST_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(path => path && existsSync(path))
if (!executablePath) throw new Error('Set COEER_TEST_BROWSER to a Chromium executable')
const browser = await chromium.launch({ executablePath, headless: true })
try {
    const page = await browser.newPage()
    const source = `data:image/png;base64,${readFileSync(sourcePath).toString('base64')}`
    mkdirSync('src/app/assets', { recursive: true })
    for (const width of [480, 960]) {
        const result = await page.evaluate(async ({ source, width }) => {
            const original = new Image()
            original.src = source
            await original.decode()
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = Math.round(original.height * width / original.width)
            const context = canvas.getContext('2d')
            context.imageSmoothingQuality = 'high'
            context.drawImage(original, 0, 0, canvas.width, canvas.height)
            const data = canvas.toDataURL('image/webp', .9)
            if (!data.startsWith('data:image/webp;')) throw new Error('WebP encoding unsupported')
            return { data: data.split(',')[1], width, height: canvas.height }
        }, { source, width })
        const bytes = Buffer.from(result.data, 'base64')
        writeFileSync(`src/app/assets/minigong-${width}.webp`, bytes)
        console.log(`${result.width} × ${result.height}: ${bytes.length} bytes`)
    }
} finally { await browser.close() }
