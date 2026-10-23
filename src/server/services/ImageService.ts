import { eq } from 'drizzle-orm'
import { db } from '../database/client'
import { uploadedImages } from '../database/schemas/images'
import { AuthService } from './AuthService'
import { IMAGE_MIME_TYPES, MAX_IMAGE_BYTES } from '@shared/images'
import { env } from '../config'

function failure(message: string, status: number) {
    return Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** Check file bytes rather than trusting a supplied extension or Content-Type. SVG is intentionally excluded. */
function imageType(bytes: Buffer): string | undefined {
    if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        && bytes.toString('ascii', 12, 16) === 'IHDR' && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0
        && bytes.toString('ascii', bytes.length - 8, bytes.length - 4) === 'IEND') return 'image/png'
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return 'image/jpeg'
    if (bytes.length >= 14 && ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6))
        && bytes.readUInt16LE(6) > 0 && bytes.readUInt16LE(8) > 0 && bytes[bytes.length - 1] === 0x3b) return 'image/gif'
    if (bytes.length >= 20 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
        && ['VP8 ', 'VP8L', 'VP8X'].includes(bytes.toString('ascii', 12, 16)) && bytes.readUInt32LE(4) + 8 === bytes.length) return 'image/webp'
}

export async function uploadImage(request: Request): Promise<Response> {
    const identity = await AuthService.getCurrentUser()
    if (!identity.success || !identity.data) return failure('请先登录', 401)
    if (identity.data.role !== 'admin') return failure('只有管理员可以上传图片', 403)
    const origin = request.headers.get('origin')
    const allowedOrigins = [new URL(request.url).origin, new URL(env.CLIENT_URL).origin]
    if ((origin && !allowedOrigins.includes(origin)) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return failure('不允许跨站上传', 403)
    }
    const mime = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
    if (!IMAGE_MIME_TYPES.some((type) => type === mime)) return failure('请选择 PNG、JPEG、GIF 或 WebP 图片', 415)
    if (Number(request.headers.get('content-length')) > MAX_IMAGE_BYTES) return failure('图片不能超过 5 MB', 413)
    if (!request.body) return failure('请选择图片', 400)

    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > MAX_IMAGE_BYTES) {
                await reader.cancel()
                return failure('图片不能超过 5 MB', 413)
            }
            chunks.push(value)
        }
    } catch {
        return failure('图片传输失败，请重试', 400)
    } finally { reader.releaseLock() }
    const bytes = Buffer.concat(chunks)
    const detected = imageType(bytes)
    if (!detected || detected !== mime) return failure('图片内容与格式不符，请选择有效图片', 415)
    const [stored] = await db.insert(uploadedImages).values({
        mimeType: detected, data: bytes.toString('base64'), uploadedBy: identity.data.id,
    }).returning({ id: uploadedImages.id })
    return Response.json({ url: `/api/images/${stored.id}` }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}

export async function readImage(imageId: string, head = false): Promise<Response> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(imageId)) return failure('图片不存在', 404)
    const [stored] = await db.select().from(uploadedImages).where(eq(uploadedImages.id, imageId)).limit(1)
    if (!stored) return failure('图片不存在', 404)
    const bytes = Buffer.from(stored.data, 'base64')
    return new Response(head ? null : bytes, { headers: {
        'Content-Type': stored.mimeType,
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
    } })
}
