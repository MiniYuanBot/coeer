import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MarkdownProps } from './Markdown'

export default function MarkdownRenderer({ content, disableLinks = false, remarkPlugins = [], rehypePlugins = [] }: MarkdownProps & Pick<Options, 'remarkPlugins' | 'rehypePlugins'>) {
    const components: Components = { img: ({ alt }) => <span>{alt}</span> }
    if (disableLinks) components.a = ({ children, title }) => <span title={title}>{children}</span>
    return <ReactMarkdown remarkPlugins={[remarkGfm, ...(remarkPlugins ?? [])]} rehypePlugins={rehypePlugins}
        skipHtml components={components}>{content}</ReactMarkdown>
}
