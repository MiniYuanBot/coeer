import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MarkdownProps } from './Markdown'

export default function MarkdownRenderer({ content, disableLinks = false, remarkPlugins = [], rehypePlugins = [] }: MarkdownProps & Pick<Options, 'remarkPlugins' | 'rehypePlugins'>) {
    const components: Components = { img: ({ alt }) => <span>{alt}</span> }
    components.a = ({ children, title, href }) => href?.startsWith('#mention-')
        ? <span className="rounded bg-primary-soft px-1 font-medium text-primary">{children}</span>
        : disableLinks ? <span title={title}>{children}</span> : <a href={href} title={title}>{children}</a>
    return <ReactMarkdown remarkPlugins={[remarkGfm, ...(remarkPlugins ?? [])]} rehypePlugins={rehypePlugins}
        skipHtml components={components}>{content}</ReactMarkdown>
}
