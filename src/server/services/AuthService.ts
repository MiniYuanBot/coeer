import { useAppSession } from '../utils/session'
import { createHash } from 'node:crypto'
import { userQueries } from '../database/queries/users'
import { verifyPassword, hashPassword } from '../utils/password'
import type {
    LoginInput,
    SignupInput,
    LoginResponse,
    SignupResponse,
    LogoutResponse,
    SessionUserResponse,
    SessionUser,
    AppSessionData,
    UpdateProfileInput,
    ChangePasswordInput,
} from '@shared/contracts'
import { signupSchema, updateProfileSchema, changePasswordSchema, STUDENT_EMAIL_PATTERN, studentIdForUser } from '@shared/contracts'
import { AUTH } from '@shared/constants'
import { EngagementService } from './EngagementService'
import { readScopedUser } from '../utils/auth-read-scope'
import { isUsernameConflict } from '../utils/username-conflict'

/**
 * Build the signed-in session payload for a DB user.
 */
function toSessionUser(user: {
    id: string
    email: string
    role: SessionUser['role']
    name: string | null
    avatarUrl?: string | null
}): SessionUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        avatarUrl: user.avatarUrl ?? null,
        role: user.role,
        studentId: studentIdForUser(user),
        lastUpdated: Date.now(),
    }
}

function passwordVersion(passwordHash: string): string {
    return createHash('sha256').update(passwordHash).digest('hex')
}

function toAppSessionData(user: Parameters<typeof toSessionUser>[0] & { passwordHash: string }): AppSessionData {
    return { ...toSessionUser(user), passwordVersion: passwordVersion(user.passwordHash) }
}

export class AuthService {
    /**
     * Returns the current session user, re-validated against the database.
     *
     * The cookie alone is not trusted for authorization: roles, names and
     * the `isActive` flag are re-read on every call (or once per explicitly
     * scoped aggregate read), so
     * demotions/bans/deletions take effect immediately instead of waiting for
     * the 7-day cookie to expire.
     */
    static async getCurrentUser(): Promise<SessionUserResponse<SessionUser>> {
        return readScopedUser(() => this.loadCurrentUser())
    }

    private static async loadCurrentUser(): Promise<SessionUserResponse<SessionUser>> {
        try {
            const session = await useAppSession()
            const id = session.data?.id
            if (!id) {
                return { success: false, state: AUTH.UNAUTHORIZED }
            }

            const dbUser = await userQueries.findById({ id })
            if (!dbUser || !dbUser.isActive || session.data.passwordVersion !== passwordVersion(dbUser.passwordHash)) {
                // Stale or deactivated session — drop it.
                await session.clear()
                return { success: false, state: AUTH.UNAUTHORIZED }
            }

            return {
                success: true,
                data: toSessionUser(dbUser),
                state: AUTH.GET_SUCCESS,
            }
        } catch (err) {
            console.error('Get current user error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async login(data: LoginInput): Promise<LoginResponse<void>> {
        try {
            const user = await userQueries.findByEmail(data)

            if (!user) {
                return { success: false, state: AUTH.NOT_FOUND }
            }

            if (!user.isActive) {
                return { success: false, state: AUTH.ACCOUNT_INACTIVE }
            }

            const isValid = await verifyPassword(data.password, user.passwordHash)

            if (!isValid) {
                return { success: false, state: AUTH.INVALID_PASSWORD }
            }

            const session = await useAppSession()
            await session.update(toAppSessionData(user))

            await EngagementService.recordDailyVisit(user.id)

            return { success: true, state: AUTH.LOGIN_SUCCESS }
        } catch (err) {
            console.error('Login error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async signup(data: SignupInput): Promise<SignupResponse<void>> {
        try {
            const parsed = signupSchema.safeParse(data)
            if (!parsed.success) {
                return { success: false, state: STUDENT_EMAIL_PATTERN.test(data.email) ? AUTH.INVALID_INPUT : AUTH.INVALID_STUDENT_EMAIL }
            }
            data = parsed.data
            const existing = await userQueries.findByEmail(data)

            if (existing) {
                if (!existing.isActive) {
                    return { success: false, state: AUTH.ACCOUNT_INACTIVE }
                }

                const isValid = await verifyPassword(data.password, existing.passwordHash)

                if (!isValid) {
                    return { success: false, state: AUTH.ALREADY_EXISTS }
                }

                // If the password matched, log in automatically.
                const session = await useAppSession()
                await session.update(toAppSessionData(existing))
                await EngagementService.recordDailyVisit(existing.id)

                return { success: true, state: AUTH.LOGIN_SUCCESS }
            }

            const passwordHash = await hashPassword(data.password)
            const user = await userQueries.createWithDefaultName({
                email: data.email,
                name: data.email.slice(0, 10),
                passwordHash,
                role: 'student',
            })

            const session = await useAppSession()
            await session.update(toAppSessionData(user))

            await EngagementService.recordDailyVisit(user.id)

            return { success: true, state: AUTH.SIGNUP_SUCCESS }
        } catch (err) {
            console.error('Signup error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async updateProfile(input: UpdateProfileInput): Promise<SessionUserResponse<SessionUser>> {
        try {
            const current = await this.getCurrentUser()
            if (!current.success || !current.data) return { success: false, state: AUTH.UNAUTHORIZED }
            const parsed = updateProfileSchema.safeParse(input)
            if (!parsed.success) return { success: false, state: { ...AUTH.INVALID_INPUT, message: parsed.error.issues[0].message } }
            const user = await userQueries.update({ id: current.data.id, name: parsed.data.name, updatedAt: new Date() })
            const session = await useAppSession()
            // Keep the original credential version if a concurrent password change revoked this session.
            await session.update({ ...toSessionUser(user), passwordVersion: session.data.passwordVersion! })
            return { success: true, data: toSessionUser(user), state: AUTH.PROFILE_UPDATED }
        } catch (err) {
            if (isUsernameConflict(err)) return { success: false, state: { ...AUTH.INVALID_INPUT, message: '该昵称已被使用（不区分大小写及 Unicode 兼容变体），请更换昵称。' } }
            console.error('Update profile error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async changePassword(input: ChangePasswordInput): Promise<SessionUserResponse<void>> {
        try {
            const current = await this.getCurrentUser()
            if (!current.success || !current.data) return { success: false, state: AUTH.UNAUTHORIZED }
            const parsed = changePasswordSchema.safeParse(input)
            if (!parsed.success) return { success: false, state: AUTH.INVALID_INPUT }
            const user = await userQueries.findById({ id: current.data.id })
            if (!user || !await verifyPassword(parsed.data.currentPassword, user.passwordHash)) {
                return { success: false, state: AUTH.INVALID_CURRENT_PASSWORD }
            }
            const changed = await userQueries.changePassword({
                id: user.id,
                currentPasswordHash: user.passwordHash,
                passwordHash: await hashPassword(parsed.data.newPassword),
            })
            if (!changed) return { success: false, state: AUTH.INVALID_CURRENT_PASSWORD }
            const session = await useAppSession()
            await session.clear()
            return { success: true, state: AUTH.PASSWORD_CHANGED }
        } catch (err) {
            console.error('Change password error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async logout(): Promise<LogoutResponse<void>> {
        try {
            const session = await useAppSession()
            await session.clear()
            return { success: true, state: AUTH.LOGOUT_SUCCESS }
        } catch (err) {
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }
}
