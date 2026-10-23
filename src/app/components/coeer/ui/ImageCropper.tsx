import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { ImageSpec } from '@shared/images'
import { Modal } from '../feedback/Modal'
import { Button } from './Button'
import { Field } from './Field'
import { clampCropCenter, imageCropRect, type CropCenter } from '../lib/imageCrop'

export function ImageCropper({ source, spec, onCancel, onConfirm }: {
    source: File | string
    spec: ImageSpec
    onCancel: () => void
    onConfirm: (file: File) => void
}) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const [image, setImage] = useState<HTMLImageElement | null>(null)
    const [center, setCenter] = useState<CropCenter>({ x: .5, y: .5 })
    const [zoom, setZoom] = useState(1)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const drag = useRef<{ pointerId: number; x: number; y: number; center: CropCenter } | null>(null)
    const ratio = spec.width / spec.height

    useEffect(() => {
        const url = source instanceof File ? URL.createObjectURL(source) : source
        const next = new Image()
        let disposed = false
        if (!(source instanceof File)) next.crossOrigin = 'anonymous'
        next.src = url
        next.decode().then(() => {
            if (!disposed) setImage(next)
        }).catch(() => {
            if (!disposed) setError(source instanceof File ? '无法读取这张图片，请重新选择有效的图片文件。' : '无法读取外部图片，请下载后选择本地文件。')
        })
        return () => { disposed = true; if (source instanceof File) URL.revokeObjectURL(url) }
    }, [source])

    const draw = (target: HTMLCanvasElement) => {
        if (!image) return
        target.width = spec.width
        target.height = spec.height
        const context = target.getContext('2d')
        if (!context) throw new Error('浏览器无法处理图片，请换一个浏览器重试')
        const crop = imageCropRect(image.naturalWidth, image.naturalHeight, ratio, zoom, center)
        context.imageSmoothingQuality = 'high'
        context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, spec.width, spec.height)
    }
    useEffect(() => {
        if (canvas.current && image) draw(canvas.current)
    }, [image, center, zoom, spec.width, spec.height])

    const moveTo = (next: CropCenter, nextZoom = zoom) => {
        if (image) setCenter(clampCropCenter(image.naturalWidth, image.naturalHeight, ratio, nextZoom, next))
    }
    const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!image || busy || event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, center }
    }
    const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const start = drag.current
        if (!start || start.pointerId !== event.pointerId || !image || busy) return
        const bounds = event.currentTarget.getBoundingClientRect()
        const crop = imageCropRect(image.naturalWidth, image.naturalHeight, ratio, zoom, start.center)
        moveTo({
            x: start.center.x - (event.clientX - start.x) / bounds.width * crop.width / image.naturalWidth,
            y: start.center.y - (event.clientY - start.y) / bounds.height * crop.height / image.naturalHeight,
        })
    }
    const confirm = async () => {
        if (!image || busy) return
        setBusy(true)
        setError('')
        try {
            const output = document.createElement('canvas')
            draw(output)
            const blob = await new Promise<Blob>((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('裁剪失败，请重试')), 'image/png'))
            const name = source instanceof File ? source.name.replace(/\.[^.]+$/, '') : spec.label
            onConfirm(new File([blob], `${name}-crop.png`, { type: 'image/png' }))
        } catch (error) {
            setError(error instanceof Error ? error.message : '裁剪失败，请重试')
        } finally { setBusy(false) }
    }
    if (typeof document === 'undefined') return null
    return createPortal(<Modal open title={`裁剪${spec.label}`} onOpenChange={(open) => { if (!open && !busy) onCancel() }}>
        <div className="grid gap-4">
            <p className="text-[13px] leading-6 text-muted-foreground">固定比例 {spec.ratio}，输出 {spec.width} × {spec.height} 像素的 PNG 图片。拖动图片调整位置，放大可裁得更近。{source instanceof File && source.type === 'image/gif' ? ' GIF 裁剪后会转为静态图片。' : ''}</p>
            <div role="group" aria-label="裁剪区域" aria-describedby="image-crop-help" tabIndex={image && !busy ? 0 : -1}
                className="coeer-crop-stage coeer-focus relative mx-auto overflow-hidden rounded-md border border-border bg-muted touch-none select-none cursor-grab active:cursor-grabbing"
                style={{ '--crop-width': `${45 * ratio}dvh`, '--crop-mobile-width': `${32 * ratio}dvh`, aspectRatio: `${spec.width}/${spec.height}` } as CSSProperties}
                onPointerDown={pointerDown} onPointerMove={pointerMove}
                onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
                onKeyDown={(event) => {
                    if (busy || !image) return
                    const step = event.shiftKey ? .1 : .02
                    const changes: Record<string, CropCenter> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }
                    const change = changes[event.key]
                    if (change) { event.preventDefault(); moveTo({ x: center.x + change.x, y: center.y + change.y }) }
                }}>
                <canvas ref={canvas} role="img" aria-label="裁剪预览" className="block h-full w-full" />
                {!image ? <p role="status" className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted-foreground">{error ? '图片暂不可用' : '正在读取图片…'}</p> : null}
                {image ? <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">{Array.from({ length: 9 }, (_, index) => <span key={index} className="border border-white/20" />)}</div> : null}
            </div>
            <p id="image-crop-help" className="text-xs leading-5 text-muted-foreground">也可聚焦裁剪区域后使用方向键调整位置。按住 Shift 可加快移动。</p>
            <Field label={`缩放 · ${Math.round(zoom * 100)}%`}>
                <input type="range" min={1} max={4} step={.01} value={zoom} disabled={!image || busy} aria-label="缩放"
                    className="w-full accent-primary" onChange={(event) => { const value = Number(event.target.value); moveTo(center, value); setZoom(value) }} />
            </Field>
            {image && (image.naturalWidth < spec.width || image.naturalHeight < spec.height) ? <p className="text-xs leading-5 text-muted-foreground">原图小于建议尺寸，放大后可能不够清晰。</p> : null}
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="ghost" disabled={!image || busy} onClick={() => { setZoom(1); setCenter({ x: .5, y: .5 }) }}>重置裁剪</Button>
                <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={onCancel}>取消裁剪</Button><Button disabled={!image} loading={busy} onClick={() => void confirm()}>确认裁剪</Button></div>
            </div>
        </div>
    </Modal>, document.body)
}
