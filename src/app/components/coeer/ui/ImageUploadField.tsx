import { useEffect, useRef, useState } from 'react'
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@shared/images'
import { Field, Input } from './Field'
import { Button } from './Button'

/** Upload only when the containing form is saved, retaining the selection after a failed save. */
export function ImageUploadField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
    const [url, setUrl] = useState(defaultValue ?? '')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState('')
    const [error, setError] = useState('')
    const input = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (!file) { setPreview(''); return }
        const localUrl = URL.createObjectURL(file)
        setPreview(localUrl)
        return () => URL.revokeObjectURL(localUrl)
    }, [file])
    const clearFile = () => { setFile(null); if (input.current) input.current.value = '' }
    return (
        <div className="grid min-w-0 gap-3">
            <Field label={label} description="支持 PNG、JPEG、GIF、WebP，最大 5 MB。保存时上传。">
                <input ref={input} type="file" name={`${name}File`} accept={IMAGE_MIME_TYPES.join(',')} className="coeer-focus w-full min-w-0 text-sm" onChange={(event) => {
                    const selected = event.target.files?.[0]
                    if (selected && (!IMAGE_MIME_TYPES.some((type) => type === selected.type) || selected.size === 0 || selected.size > MAX_IMAGE_BYTES)) {
                        setError('请选择不超过 5 MB 的 PNG、JPEG、GIF 或 WebP 图片')
                        clearFile()
                        return
                    }
                    setError('')
                    setFile(selected ?? null)
                }} />
            </Field>
            <Field label="图片地址（也可手动填写）">
                <Input name={name} value={url} placeholder="https://… 或上传后的图片地址" onChange={(event) => { clearFile(); setUrl(event.target.value); setError('') }} />
            </Field>
            {preview || url ? <div className="flex items-center gap-3">
                <img src={preview || url} alt={`${label}预览`} className="h-24 w-24 rounded-lg border border-border bg-muted object-contain" />
                <Button variant="outline" onClick={() => { clearFile(); setUrl(''); setError('') }}>移除图片</Button>
            </div> : null}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
    )
}

export async function uploadFormImage(form: FormData, name: string): Promise<string | null> {
    const file = form.get(`${name}File`)
    if (file instanceof File && file.size) {
        const response = await fetch('/api/images/', { method: 'POST', body: file, headers: { 'Content-Type': file.type } })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || typeof result.url !== 'string') throw new Error(result.message || '图片上传失败，请重试')
        return result.url
    }
    return String(form.get(name) ?? '').trim() || null
}
