import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref, type TextareaHTMLAttributes } from 'react'
import { Markdown, MarkdownHelp } from './Markdown'
import { cn } from '../lib/cn'
import { getMentionCandidatesFn } from '~/functions/mentions'
import { mentionToken } from '@shared/mentions'

type MarkdownEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue'> & {
    label?: string
    previewLabel?: string
    value?: string
    defaultValue?: string
    ref?: Ref<HTMLTextAreaElement>
    groupId?: string
    onValueChange?: (value: string) => void
}

/** Uses the same safe renderer as published content, with native form submission and reset support. */
export function MarkdownEditor({ label, previewLabel, id, value, defaultValue = '', onChange, onValueChange, groupId, ref, rows = 8, className,
    'aria-describedby': describedBy, ...props }: MarkdownEditorProps) {
    const generatedId = useId()
    const inputId = id ?? `markdown-${generatedId}`
    const helpId = `${inputId}-help`
    const input = useRef<HTMLTextAreaElement>(null)
    const [draft, setDraft] = useState(defaultValue)
    const content = value ?? draft
    const [mention, setMention] = useState<{ start: number; end: number; search: string }>()
    const [candidates, setCandidates] = useState<{ id: string; name: string | null }[]>([])
    const [mentionError, setMentionError] = useState('')
    const [mentionLoading, setMentionLoading] = useState(false)
    const [selected, setSelected] = useState(0)
    function findMention(element: HTMLTextAreaElement) {
        if (!groupId) return
        const end = element.selectionStart
        const match = element.value.slice(0, end).match(/(?:^|[^\w@])@([^@\n\[\]]{0,63})$/)
        setMention(match ? { start: end - match[1].length - 1, end, search: match[1] } : undefined)
        setSelected(0)
    }
    useEffect(() => {
        setCandidates([]); setMentionError('')
        if (!mention || !groupId) { setMentionLoading(false); return }
        setMentionLoading(true)
        let active = true
        const timer = setTimeout(() => {
            void getMentionCandidatesFn({ data: { groupId, search: mention.search } })
                .then(items => { if (active) setCandidates(items) })
                .catch(() => { if (active) setMentionError('成员加载失败，请重新输入 @ 重试') })
                .finally(() => { if (active) setMentionLoading(false) })
        }, 200)
        return () => { active = false; clearTimeout(timer) }
    }, [groupId, mention?.search, mention?.start])
    function insertMention(member: { id: string; name: string | null }) {
        if (!mention) return
        const token = mentionToken(member) + ' '
        const next = content.slice(0, mention.start) + token + content.slice(mention.end)
        if (props.maxLength && next.length > props.maxLength) { setMentionError('内容已达到长度上限'); return }
        const caret = mention.start + token.length
        setDraft(next); onValueChange?.(next); setMention(undefined)
        requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(caret, caret) })
    }
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
                onChange={(event) => { setDraft(event.target.value); onChange?.(event); onValueChange?.(event.target.value); findMention(event.target) }}
                onClick={event => { props.onClick?.(event); findMention(event.currentTarget) }}
                onKeyDown={event => {
                    props.onKeyDown?.(event)
                    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
                    if (!mention) return
                    if (event.key === 'Escape') { event.preventDefault(); setMention(undefined) }
                    if (candidates.length && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
                        event.preventDefault()
                        if (event.key === 'Enter') insertMention(candidates[selected] ?? candidates[0])
                        else setSelected(index => (index + (event.key === 'ArrowDown' ? 1 : -1) + candidates.length) % candidates.length)
                    }
                }}
                className="coeer-focus coeer-field min-w-0 w-full resize-y rounded-md border border-control-border bg-card p-3 text-sm leading-6 disabled:bg-muted disabled:text-muted-foreground" />
            <section aria-label={previewLabel ?? `${label || '内容'}实时预览`} className="max-h-[32rem] min-w-0 overflow-auto rounded-md border border-border bg-card p-3">
                <p className="mb-2 text-xs font-medium text-muted-foreground">实时预览</p>
                {content.trim() ? <Markdown content={content} /> : <p className="text-sm text-muted-foreground">输入内容后，这里会实时显示排版和公式。</p>}
            </section>
        </div>
        {groupId && <p className="mt-2 text-xs text-muted-foreground">输入 @ 搜索并选择群内成员，对方会收到站内通知。</p>}
        {mention && !props.disabled && <div aria-label="选择要提及的群内成员" className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-card p-2">
            {mentionLoading ? <p role="status" className="p-2 text-xs">正在查找成员…</p> : mentionError ? <p role="alert" className="p-2 text-xs text-danger">{mentionError}</p> : !candidates.length ? <p className="p-2 text-xs text-muted-foreground">没有匹配的群内成员</p> : candidates.map((member, index) =>
                <button type="button" key={member.id} onClick={() => insertMention(member)} className={`coeer-focus block w-full rounded p-2 text-left text-sm ${index === selected ? 'bg-primary-soft text-primary' : 'hover:bg-muted'}`}>
                    @{member.name || '成员'} <span className="text-xs text-muted-foreground">{member.id.slice(0, 8)}</span>
                </button>)}
        </div>}
        <div id={helpId}><MarkdownHelp /></div>
    </div>
}
