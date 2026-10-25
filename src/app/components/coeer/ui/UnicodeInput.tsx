import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { contentUnicodeError, usernameError } from '@shared/unicode'
import { Input, Textarea } from './Field'

/** Opt-in validation: identifiers and community prose never share a strict filter. */
export function UnicodeInput({ policy = 'content', value, defaultValue, onChange, ...props }:
    InputHTMLAttributes<HTMLInputElement> & { policy?: 'username' | 'content' }) {
    const [draft, setDraft] = useState(String(defaultValue ?? ''))
    const ref = useRef<HTMLInputElement>(null)
    const id = useId()
    const current = String(value ?? draft)
    const error = policy === 'username' ? usernameError(current) : contentUnicodeError(current)
    useEffect(() => { ref.current?.setCustomValidity(error ?? '') }, [error])
    useEffect(() => {
        const form = ref.current?.form
        const reset = () => queueMicrotask(() => setDraft(String(defaultValue ?? '')))
        form?.addEventListener('reset', reset)
        return () => form?.removeEventListener('reset', reset)
    }, [defaultValue])
    return <>
        <Input {...props} ref={ref} value={value ?? draft}
            aria-invalid={!!error} aria-describedby={[props['aria-describedby'], error && id].filter(Boolean).join(' ') || undefined}
            onChange={event => { setDraft(event.currentTarget.value); onChange?.(event) }} />
        {error && <span id={id} role="alert" className="mt-1 block text-xs font-normal text-danger">{error}</span>}
    </>
}

export function UnicodeTextarea({ value, defaultValue, onChange, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    const [draft, setDraft] = useState(String(defaultValue ?? ''))
    const ref = useRef<HTMLTextAreaElement>(null)
    const id = useId()
    const error = contentUnicodeError(String(value ?? draft))
    useEffect(() => { ref.current?.setCustomValidity(error ?? '') }, [error])
    useEffect(() => {
        const form = ref.current?.form
        const reset = () => queueMicrotask(() => setDraft(String(defaultValue ?? '')))
        form?.addEventListener('reset', reset)
        return () => form?.removeEventListener('reset', reset)
    }, [defaultValue])
    return <>
        <Textarea {...props} ref={ref} value={value ?? draft}
            aria-invalid={!!error} aria-describedby={[props['aria-describedby'], error && id].filter(Boolean).join(' ') || undefined}
            onChange={event => { setDraft(event.currentTarget.value); onChange?.(event) }} />
        {error && <span id={id} role="alert" className="mt-1 block text-xs font-normal text-danger">{error}</span>}
    </>
}
