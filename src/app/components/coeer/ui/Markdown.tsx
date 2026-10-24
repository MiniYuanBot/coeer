import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { memo } from 'react'
import { cn } from '../lib/cn'

/** Raw HTML stays disabled; KaTeX cannot create trusted HTML or external resources. */
export const Markdown = memo(function Markdown({ content, className, disableLinks = false }: { content: string; className?: string; disableLinks?: boolean }) {
    const components: Components = { img: ({ alt }) => <span>{alt}</span> }
    if (disableLinks) components.a = ({ children, title }) => <span title={title}>{children}</span>
    return <div className={cn('coeer-markdown min-w-0 text-base leading-[1.8] text-foreground', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 200, maxSize: 20, minRuleThickness: 0.06 }]]}
            skipHtml components={components}>
            {content}
        </ReactMarkdown>
    </div>
})

/** Render complete source before clipping; suppress links inside clickable cards. */
export function MarkdownSummary({ content, className }: { content: string; className?: string }) {
    return <Markdown content={content} disableLinks className={cn('coeer-markdown-summary max-h-20 overflow-hidden text-[13px] leading-6', className)} />
}

export function MarkdownHelp() {
    return <p className="mt-2 text-xs leading-6 text-muted-foreground">
        支持 Markdown（加粗、列表、链接、代码）和 LaTeX：行内公式用 <code>$x^2$</code>，独立公式用 <code>$$…$$</code>。
    </p>
}
