import { lazy, memo, Suspense } from 'react'
import { cn } from '../lib/cn'

export type MarkdownProps = { content: string; className?: string; disableLinks?: boolean }
const RichMarkdown = lazy(() => import('./MarkdownRenderer'))
const MathMarkdown = lazy(() => import('./MathMarkdown'))

/** Conservative fast path: ambiguous syntax always uses the real Markdown parser. */
export function isPlainMarkdown(content: string) {
    return !content.trim() || (!/[\n\r\\`*_{}\[\]<>()#+.!|~>$&:@\-]/.test(content) && content.trim() === content)
}

/** Suspense streams complete Markdown during SSR and loads parsers only when needed. */
export const Markdown = memo(function Markdown({ content, className, disableLinks = false }: MarkdownProps) {
    const plain = content.trim() ? <p>{content}</p> : null
    const Renderer = content.includes('$') ? MathMarkdown : RichMarkdown
    return <div className={cn('coeer-markdown min-w-0 text-base leading-[1.8] text-foreground', className)}>
        {isPlainMarkdown(content) ? plain : <Suspense fallback={plain}>
            <Renderer content={content} disableLinks={disableLinks} />
        </Suspense>}
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
