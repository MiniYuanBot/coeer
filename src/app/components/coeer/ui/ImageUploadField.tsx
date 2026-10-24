import { useEffect, useId, useRef, useState, type DragEvent } from 'react'
import { IMAGE_MIME_TYPES, IMAGE_SPECS, MAX_IMAGE_BYTES, type ImageSpecName } from '@shared/images'
import { Field, Input } from './Field'
import { Button } from './Button'
import { Icon } from './Icon'
import { cn } from '../lib/cn'
import { ImageCropper } from './ImageCropper'

/** Upload only when the containing form is saved, retaining the selection after a failed save. */
export function ImageUploadField({ name, label, defaultValue, disabled = false, preset }: { name: string; label: string; defaultValue?: string | null; disabled?: boolean; preset?: ImageSpecName }) {
    const id = useId()
    const spec = preset ? IMAGE_SPECS[preset] : undefined
    const [url, setUrl] = useState(defaultValue ?? '')
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState('')
    const [error, setError] = useState('')
    const [dragging, setDragging] = useState(false)
    const [failedSrc, setFailedSrc] = useState('')
    const [cropSource, setCropSource] = useState<File | string | null>(null)
    const [originalSource, setOriginalSource] = useState<File | string | null>(null)
    const dragDepth = useRef(0)
    const input = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (!file) { setPreview(''); return }
        const localUrl = URL.createObjectURL(file)
        setPreview(localUrl)
        return () => URL.revokeObjectURL(localUrl)
    }, [file])
    const imageSrc = preview || url
    const clearFile = () => { setFile(null); setOriginalSource(null); if (input.current) input.current.value = '' }
    const setInputFile = (next: File | null) => {
        if (!input.current) return
        const transfer = new DataTransfer()
        if (next) transfer.items.add(next)
        input.current.files = transfer.files
    }
    const choose = (files: FileList | null) => {
        if (disabled || input.current?.matches(':disabled')) return
        if (!files?.length) { setInputFile(file); return }
        const selected = files[0]
        if (files.length !== 1 || !IMAGE_MIME_TYPES.some((type) => type === selected.type) || selected.size === 0 || selected.size > MAX_IMAGE_BYTES) {
            setError(files.length !== 1 ? '一次只能选择一张图片' : '请选择不超过 5 MB 的 PNG、JPEG、GIF 或 WebP 图片')
            setInputFile(file)
            return
        }
        setError('')
        if (spec) {
            // Keep the confirmed image in FormData until the new crop is accepted.
            setInputFile(file)
            setCropSource(selected)
        } else {
            setInputFile(selected)
            setFile(selected)
            setUrl('')
            setFailedSrc('')
        }
    }
    const stopDrag = () => { dragDepth.current = 0; setDragging(false) }
    const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes('Files')
    const blocked = () => disabled || !!input.current?.matches(':disabled')
    return (
        <div role="group" aria-labelledby={`${id}-label`} className="grid min-w-0 gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <span id={`${id}-label`} className="text-xs font-medium">{label}</span>
                <Button variant="outline" disabled={disabled} aria-controls={`${id}-file`} onClick={() => input.current?.click()}>
                    <Icon name="plus" />选择本地文件
                </Button>
            </div>
            {spec ? <p className="text-xs leading-5 text-muted-foreground">展示比例 {spec.ratio}，建议 {spec.width} × {spec.height} 像素。选择图片后可拖动、缩放裁剪。</p> : null}
            <input ref={input} id={`${id}-file`} hidden type="file" name={`${name}File`} aria-label={`${label}本地文件`}
                disabled={disabled} accept={IMAGE_MIME_TYPES.join(',')} onChange={(event) => choose(event.target.files)} />
            <div role="region" aria-label={`${label}文件区域`} aria-describedby={`${id}-hint`} aria-disabled={disabled}
                data-dragging={dragging && !disabled || undefined}
                className={cn('coeer-image-dropzone grid min-h-40 min-w-0 content-center rounded-lg border border-dashed border-control-border bg-muted p-4 transition-colors', disabled && 'cursor-not-allowed')}
                onDragEnter={(event) => {
                    if (!isFileDrag(event)) return
                    event.preventDefault()
                    if (blocked()) return
                    dragDepth.current += 1
                    setDragging(true)
                }}
                onDragOver={(event) => {
                    if (!isFileDrag(event)) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = blocked() ? 'none' : 'copy'
                }}
                onDragLeave={(event) => {
                    if (!isFileDrag(event)) return
                    event.preventDefault()
                    dragDepth.current = Math.max(0, dragDepth.current - 1)
                    if (!dragDepth.current) setDragging(false)
                }}
                onDrop={(event) => {
                    event.preventDefault()
                    stopDrag()
                    if (!blocked()) choose(event.dataTransfer.files)
                }}>
                {imageSrc ? <div className="flex min-w-0 flex-wrap items-center gap-4">
                    <div className="grid w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card text-muted-foreground"
                        style={{ aspectRatio: spec ? `${spec.width}/${spec.height}` : '1' }}>
                        {failedSrc !== imageSrc ? <img src={imageSrc} alt={`${label}预览`} className="h-full w-full object-contain" onError={() => setFailedSrc(imageSrc)} /> : <Icon name="inbox" className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-all text-[13px] font-medium">{file?.name || '当前图片'}</p>
                        <p className="text-xs leading-5 text-muted-foreground">{failedSrc === imageSrc ? '图片无法预览，可重新选择文件或修改链接。' : file ? `${formatSize(file.size)} · 保存后上传` : '可拖入新图片替换'}</p>
                        <div className="-ml-2.5 flex flex-wrap gap-1">
                            {spec ? <Button variant="ghost" size="sm" disabled={disabled} onClick={() => setCropSource(originalSource ?? url)}>调整裁剪</Button> : null}
                            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => { clearFile(); setUrl(''); setError(''); setFailedSrc('') }}>
                                <Icon name="x" />移除图片
                            </Button>
                        </div>
                    </div>
                </div> : <div className="grid justify-items-center gap-2 py-3 text-center">
                    <Icon name="inbox" className="h-7 w-7 text-muted-foreground" />
                    <p className="text-[13px] font-medium">{dragging ? '松开鼠标，选择这张图片' : '拖动图片到这里'}</p>
                    <p className="text-xs leading-5 text-muted-foreground">或点击上方按钮选择本地文件</p>
                </div>}
            </div>
            <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">PNG、JPEG、GIF、WebP · 最大 5 MB</p>
            {error ? <p role="alert" className="text-xs leading-5 text-danger">{error}</p> : null}
            <details className="group min-w-0">
                <summary className="coeer-focus flex w-fit cursor-pointer list-none items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                    使用图片链接<Icon name="chevron" className="h-3 w-3 transition-transform group-open:rotate-90" />
                </summary>
                <Field label="图片地址" className="pt-3">
                    <Input name={name} value={url} disabled={disabled} placeholder="https://… 或已上传的图片地址" onChange={(event) => { clearFile(); setUrl(event.target.value); setError(''); setFailedSrc('') }} />
                </Field>
            </details>
            {cropSource && spec ? <ImageCropper key={typeof cropSource === 'string' ? cropSource : `${cropSource.name}:${cropSource.lastModified}`} source={cropSource} spec={spec}
                onCancel={() => setCropSource(null)} onConfirm={(cropped) => {
                    setInputFile(cropped)
                    setFile(cropped)
                    setOriginalSource(cropSource)
                    setUrl('')
                    setFailedSrc('')
                    setError('')
                    setCropSource(null)
                }} /> : null}
        </div>
    )
}

function formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
