import { createElement } from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { PassThrough } from 'node:stream'
import { parseHTML } from 'linkedom'
import { describe, expect, it, vi } from 'vitest'
vi.mock('katex/dist/katex.min.css?url', () => ({ default: '/assets/katex-test.css' }))
import { Markdown } from '@/components/coeer/ui/Markdown'

async function render(content: string) {
    const html = await new Promise<string>((resolve, reject) => {
        const output = new PassThrough()
        let html = ''
        output.on('data', chunk => { html += chunk.toString() })
        output.on('end', () => resolve(html))
        const stream = renderToPipeableStream(createElement(Markdown, { content }), {
            onAllReady() { stream.pipe(output) }, onError: reject,
        })
    })
    return parseHTML(html).document
}

describe('community Markdown and LaTeX', () => {
    it('preserves plain text and empty previews without requiring a parser', async () => {
        expect((await render('普通正文')).querySelector('p')?.textContent).toBe('普通正文')
        expect((await render(' \n\t ')).querySelector('p')).toBeNull()
    })
    it('renders a calculus help post with headings, lists, emphasis and inline/display formulas', async () => {
        const document = await render(String.raw`## 求助：这题怎么积？

**换元**，令 $u=x^2$。

$$
\int_0^1 x e^{x^2}\,\mathrm{d}x = \frac{e-1}{2}
$$

- 检查上下限
- 检查微分`)
        expect(document.querySelector('h2')?.textContent).toBe('求助：这题怎么积？')
        expect(document.querySelector('strong')?.textContent).toBe('换元')
        expect(document.querySelectorAll('li')).toHaveLength(2)
        expect(document.querySelectorAll('.katex')).toHaveLength(2)
        expect(document.querySelector('.katex-display math')).not.toBeNull()
        expect(document.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toBe('u=x^2')
    })
    it('preserves plain-text newlines and code without interpreting code formulas', async () => {
        const document = await render('第一行\n第二行\n\n`$x^2$`\n\n```latex\n\\int_0^1 x dx\n```')
        expect(document.querySelector('p')?.textContent).toBe('第一行\n第二行')
        expect(document.querySelector('code')?.textContent).toBe('$x^2$')
        expect(document.querySelector('pre code')?.textContent).toContain('\\int_0^1')
        expect(document.querySelector('.katex')).toBeNull()
    })
    it('renders malformed formulas as readable errors without crashing the page', async () => {
        const document = await render(String.raw`求助 $\frac{1}{$ 这一步哪里错了？`)
        expect(document.querySelector('.katex-error')).not.toBeNull()
        expect(document.querySelector('.coeer-markdown')?.textContent).toContain('这一步哪里错了')
    })
    it('rejects raw HTML, unsafe links and trusted LaTeX commands', async () => {
        const document = await render(String.raw`<script>alert(1)</script>

<img src=x onerror=alert(1)>

[链接](javascript:alert%281%29)

$\href{javascript:alert(1)}{危险}$

$\htmlClass{injected}{内容}$

$\includegraphics{https://example.test/track.png}$`)
        expect(document.querySelector('script, img, iframe, .injected')).toBeNull()
        for (const link of document.querySelectorAll('a')) expect(link.getAttribute('href') || '').not.toMatch(/^javascript:/i)
    })
    it('renders links and GFM tables', async () => {
        const document = await render('[资料](https://example.com)\n\n| 方法 | 结果 |\n| --- | --- |\n| 换元 | 正确 |')
        expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
        expect(document.querySelectorAll('td')).toHaveLength(2)
    })
})
