import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
export { studentIdFromEmail } from '@shared/contracts/auth'

const key = Symbol.for('coeer.spaces.identity-secret')
const state = globalThis as typeof globalThis & { [key]?: string }
const identitySchema = z.object({
    id: z.string().min(1).max(200),
    email: z.string().email().max(254),
    name: z.string().min(1).max(100),
    role: z.string().min(1).max(40),
    issuedAt: z.number().int(),
})
export type CommunityIdentity = Omit<z.infer<typeof identitySchema>, 'issuedAt'>

/** A remote engine must share an explicit server secret with COEER. */
export function communityIdentitySecret() {
    if (process.env.OPENSPACE_INTERNAL_AUTH_SECRET) return process.env.OPENSPACE_INTERNAL_AUTH_SECRET
    if (process.env.OPENSPACE_BACKEND_URL) throw new Error('OPENSPACE_INTERNAL_AUTH_SECRET is required for a remote booking engine')
    return state[key] ??= randomBytes(48).toString('base64url')
}
const signature = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url')
export function signCommunityIdentity(identity: CommunityIdentity, secret: string) {
    const payload = Buffer.from(JSON.stringify({ ...identity, issuedAt: Date.now() })).toString('base64url')
    return `${payload}.${signature(payload, secret)}`
}
export function verifyCommunityIdentity(value: string | undefined, secret: string): CommunityIdentity | null {
    if (!value || value.length > 4096) return null
    const [payload, signed, extra] = value.split('.')
    if (!payload || !signed || extra) return null
    const expected = Buffer.from(signature(payload, secret))
    const received = Buffer.from(signed)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null
    try {
        const identity = identitySchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString()))
        if (Math.abs(Date.now() - identity.issuedAt) > 30000) return null
        return identity
    } catch {
        return null
    }
}
export const communityCsrf = (identity: CommunityIdentity, secret: string) => signature(`csrf:${identity.id}`, secret)
