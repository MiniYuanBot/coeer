import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref, type TextareaHTMLAttributes } from 'react'
import { Markdown, MarkdownHelp } from './Markdown'
import { cn } from '../lib/cn'

type MarkdownEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue'> & {
    label?: string
    previewLabel?: string
    value?: string
    defaultValue?: string
    ref?: Ref<HTMLTextAreaElement>
}

/** Uses the same safe renderer as published content, with native form submission and reset support. */
export function MarkdownEditor({ label, previewLabel, id, value, defaultValue = '', onChange, ref, rows = 8, className,
    'aria-describedby': describedBy, ...props }: MarkdownEditorProps) {
    const generatedId = useId()
    const inputId = id ?? `markdown-${generatedId}`
    const helpId = `${inputId}-help`
    const input = useRef<HTMLTextAreaElement>(null)
    const [draft, setDraft] = useState(defaultValue)
    const content = value ?? draft
    useImperativeHandle(ref, () => input.current!, [])

    useEffect(() => {
        const form = input.current?.form
        function reset(event: Event) {
            queueMicrotask(() => { if (!event.defaultPrevented) setDraft(defaultValue) })
        }
        form?.addEventListener('reset', reset)
        return () => form?.removeEventListener('reset', reset)
    }, [defaultValue])

    return <div className={cn('coeer-markdown-editor min-w-0', className)}>
        {label ? <label htmlFor={inputId} className="mb-2 block text-sm font-medium">{label}</label> : null}
        <div className="coeer-markdown-editor-layout">
            <textarea {...props} ref={input} id={inputId} rows={rows} value={content}
                aria-describedby={[describedBy, helpId].filter(Boolean).join(' ')}
                onChange={(event) => { setDraft(event.target.value); onChange?.(event) }}
                className="coeer-focus coeer-field min-w-0 w-full resize-y rounded-md border border-control-border bg-card p-3 text-sm leading-6 disabled:bg-muted disabled:text-muted-foreground" />
            <section aria-label={previewLabel ?? `${label || '内容'}实时预览`} className="max-h-[32rem] min-w-0 overflow-auto rounded-md border border-border bg-card p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">实时预览</p>
                {content.trim() ? <Markdown content={content} /> : <p className="text-sm text-muted-foreground">输入内容后，这里会实时显示排版和公式。</p>}
            </section>
        </div>
        <div id={helpId}><MarkdownHelp /></div>
    </div>
}
