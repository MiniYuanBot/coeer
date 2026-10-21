import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { Markdown } from '@/components/coeer/ui/Markdown'

function render(content: string) {
    return parseHTML(renderToStaticMarkup(createElement(Markdown, { content }))).document
}

describe('community Markdown and LaTeX', () => {
    it('renders a calculus help post with headings, lists, emphasis and inline/display formulas', () => {
        const document = render(String.raw`## 求助：这题怎么积？

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
    it('preserves plain-text newlines and code without interpreting code formulas', () => {
        const document = render('第一行\n第二行\n\n`$x^2$`\n\n```latex\n\\int_0^1 x dx\n```')
        expect(document.querySelector('p')?.textContent).toBe('第一行\n第二行')
        expect(document.querySelector('code')?.textContent).toBe('$x^2$')
        expect(document.querySelector('pre code')?.textContent).toContain('\\int_0^1')
        expect(document.querySelector('.katex')).toBeNull()
    })
    it('renders malformed formulas as readable errors without crashing the page', () => {
        const document = render(String.raw`求助 $\frac{1}{$ 这一步哪里错了？`)
        expect(document.querySelector('.katex-error')).not.toBeNull()
        expect(document.querySelector('.coeer-markdown')?.textContent).toContain('这一步哪里错了')
    })
    it('rejects raw HTML, unsafe links and trusted LaTeX commands', () => {
        const document = render(String.raw`<script>alert(1)</script>

<img src=x onerror=alert(1)>

[链接](javascript:alert%281%29)

$\href{javascript:alert(1)}{危险}$

$\htmlClass{injected}{内容}$

$\includegraphics{https://example.test/track.png}$`)
        expect(document.querySelector('script, img, iframe, .injected')).toBeNull()
        for (const link of document.querySelectorAll('a')) expect(link.getAttribute('href') || '').not.toMatch(/^javascript:/i)
    })
    it('renders links and GFM tables', () => {
        const document = render('[资料](https://example.com)\n\n| 方法 | 结果 |\n| --- | --- |\n| 换元 | 正确 |')
        expect(document.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
        expect(document.querySelectorAll('td')).toHaveLength(2)
    })
})
