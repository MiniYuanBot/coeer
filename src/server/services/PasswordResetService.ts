import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, gte, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../database/client'
import { passwordResets, users } from '../database/schemas'
import { requestPasswordResetSchema, resetPasswordSchema, type SessionUserResponse } from '@shared/contracts/auth'
import { AUTH } from '@shared/constants/auth'
import { hashPassword } from '../utils/password'
import { passwordResetMailConfigured, sendPasswordResetEmail } from '../utils/mail'

const digest = (value: string) => createHash('sha256').update(value).digest('hex')

export class PasswordResetService {
    static async request(input: z.infer<typeof requestPasswordResetSchema>): Promise<SessionUserResponse<void>> {
        const parsed = requestPasswordResetSchema.safeParse(input)
        if (!parsed.success) return { success: false, state: AUTH.INVALID_INPUT }
        if (!passwordResetMailConfigured()) return { success: false, state: AUTH.MAIL_UNAVAILABLE }
        try {
            const emailHash = digest(parsed.data.email.toLowerCase())
            const issued = await db.transaction(async (tx) => {
                // Rate limits also apply to unknown emails and across server instances.
                await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${emailHash}, 0))`)
                const recent = await tx.select().from(passwordResets).where(and(eq(passwordResets.emailHash, emailHash), gte(passwordResets.createdAt, new Date(Date.now() - 3600000))))
                if (recent.length >= 5 || recent.some((row) => row.createdAt.getTime() > Date.now() - 60000)) return null
                await tx.delete(passwordResets).where(lt(passwordResets.createdAt, new Date(Date.now() - 86400000)))
                const [user] = await tx.select().from(users).where(and(eq(users.email, parsed.data.email), eq(users.isActive, true)))
                const token = randomBytes(32).toString('hex')
                const [record] = await tx.insert(passwordResets).values({
                    emailHash, userId: user?.id, tokenHash: digest(token), passwordVersion: user ? digest(user.passwordHash) : null,
                    expiresAt: new Date(Date.now() + 1800000),
                }).returning()
                return { record, user, token }
            })
            if (issued?.user) {
                try { await sendPasswordResetEmail(issued.user.email, issued.token) }
                catch {
                    // Keep the rate limit record, but invalidate an undelivered link.
                    await db.update(passwordResets).set({ consumedAt: new Date() }).where(eq(passwordResets.id, issued.record.id))
                    return { success: false, state: AUTH.MAIL_UNAVAILABLE }
                }
            }
            return { success: true, state: AUTH.RESET_REQUESTED }
        } catch {
            console.error('Password reset request failed')
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async reset(input: z.infer<typeof resetPasswordSchema>): Promise<SessionUserResponse<void>> {
        const parsed = resetPasswordSchema.safeParse(input)
        if (!parsed.success) return { success: false, state: AUTH.INVALID_INPUT }
        try {
            const tokenHash = digest(parsed.data.token)
            const [record] = await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash, tokenHash), gt(passwordResets.expiresAt, new Date())))
            if (!record?.userId || record.consumedAt) return { success: false, state: AUTH.RESET_INVALID }
            const passwordHash = await hashPassword(parsed.data.newPassword)
            const changed = await db.transaction(async (tx) => {
                // Always lock the user first, including when two distinct links are used concurrently.
                const [user] = await tx.select().from(users).where(eq(users.id, record.userId!)).for('update')
                const [current] = await tx.select().from(passwordResets).where(eq(passwordResets.id, record.id)).for('update')
                if (!user?.isActive || !current || current.consumedAt || current.expiresAt.getTime() <= Date.now() || current.passwordVersion !== digest(user.passwordHash)) return false
                await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))
                await tx.update(passwordResets).set({ consumedAt: new Date() }).where(eq(passwordResets.userId, user.id))
                return true
            })
            return { success: changed, state: changed ? AUTH.PASSWORD_CHANGED : AUTH.RESET_INVALID }
        } catch {
            console.error('Password reset failed')
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }
}
