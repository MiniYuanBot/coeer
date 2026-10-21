import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { cn } from '../lib/cn'

/** Raw HTML stays disabled; KaTeX cannot create trusted HTML or external resources. */
export function Markdown({ content, className }: { content: string; className?: string }) {
    return <div className={cn('coeer-markdown min-w-0 text-sm leading-7', className)}>
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 200, maxSize: 20, minRuleThickness: 0.06 }]]}
            skipHtml components={{ img: ({ alt }) => <span>{alt}</span> }}>
            {content}
        </ReactMarkdown>
    </div>
}

export function MarkdownHelp() {
    return <p className="mt-2 text-xs leading-6 text-muted-foreground">
        支持 Markdown（加粗、列表、链接、代码）和 LaTeX：行内公式用 <code>$x^2$</code>，独立公式用 <code>$$…$$</code>。
    </p>
}
