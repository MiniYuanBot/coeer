export type CropCenter = { x: number; y: number }
export type CropRect = { x: number; y: number; width: number; height: number }

/** Source coordinates of a fixed-ratio crop, clamped so no blank edges are exported. */
export function imageCropRect(width: number, height: number, ratio: number, zoom: number, center: CropCenter): CropRect {
    const cropWidth = Math.min(width, height * ratio) / Math.max(1, zoom)
    const cropHeight = cropWidth / ratio
    return {
        x: Math.max(0, Math.min(width - cropWidth, center.x * width - cropWidth / 2)),
        y: Math.max(0, Math.min(height - cropHeight, center.y * height - cropHeight / 2)),
        width: cropWidth, height: cropHeight,
    }
}

export function clampCropCenter(width: number, height: number, ratio: number, zoom: number, center: CropCenter): CropCenter {
    const crop = imageCropRect(width, height, ratio, zoom, center)
    return { x: (crop.x + crop.width / 2) / width, y: (crop.y + crop.height / 2) / height }
}
