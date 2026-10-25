import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import katexCss from 'katex/dist/katex.min.css?url'
import MarkdownRenderer from './MarkdownRenderer'
import type { MarkdownProps } from './Markdown'

export default function MathMarkdown(props: MarkdownProps) {
    return <>
        {/* Keep the stylesheet with the SSR fragment without a CSS-dependent Suspense boundary. */}
        <link rel="stylesheet" href={katexCss} />
        <MarkdownRenderer {...props} remarkPlugins={[remarkMath]}
            rehypePlugins={[[rehypeKatex, { trust: false, strict: 'ignore', maxExpand: 200, maxSize: 20, minRuleThickness: 0.06 }]]} />
    </>
}
