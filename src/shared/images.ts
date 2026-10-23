import { z } from 'zod'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const

export const IMAGE_SPECS = {
    card: { width: 600, height: 800, ratio: '3:4', label: '卡面' },
    achievement: { width: 512, height: 512, ratio: '1:1', label: '成就图标' },
    redeem: { width: 960, height: 540, ratio: '16:9', label: '商品图片' },
} as const
export type ImageSpecName = keyof typeof IMAGE_SPECS
export type ImageSpec = typeof IMAGE_SPECS[ImageSpecName]

/** Only our image endpoint, bundled demo assets, or HTTP(S) images can be persisted. */
export const ImageUrlSchema = z.string().trim().max(2048).refine((value) => {
    if (/^\/api\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return true
    if (/^\/demo\/[a-z0-9-]+\.(?:svg|png|jpe?g|gif|webp)$/i.test(value)) return true
    try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}, '请上传图片或填写有效的 HTTP(S) 图片地址')
