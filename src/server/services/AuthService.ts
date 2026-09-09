import { useAppSession } from '../utils/session'
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
} from '@shared/contracts'
import { AUTH } from '@shared/constants'

/**
 * Build the signed-in session payload for a DB user.
 */
function toSessionUser(user: {
    id: string
    email: string
    role: SessionUser['role']
    name: string | null
}): SessionUser {
    return {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        lastUpdated: Date.now(),
    }
}

export class AuthService {
    /**
     * Returns the current session user, re-validated against the database.
     *
     * The cookie alone is not trusted for authorization: roles, names and
     * the `isActive` flag are re-read from the users table on every call, so
     * demotions/bans/deletions take effect immediately instead of waiting for
     * the 7-day cookie to expire.
     */
    static async getCurrentUser(): Promise<SessionUserResponse<SessionUser>> {
        try {
            const session = await useAppSession()
            const id = session.data?.id
            if (!id) {
                return { success: false, state: AUTH.UNAUTHORIZED }
            }

            const dbUser = await userQueries.findById({ id })
            if (!dbUser || !dbUser.isActive) {
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
            await session.update(toSessionUser(user))

            return { success: true, state: AUTH.LOGIN_SUCCESS }
        } catch (err) {
            console.error('Login error:', err)
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async signup(data: SignupInput): Promise<SignupResponse<void>> {
        try {
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
                await session.update(toSessionUser(existing))

                return { success: true, state: AUTH.LOGIN_SUCCESS }
            }

            const passwordHash = await hashPassword(data.password)
            const user = await userQueries.create({
                email: data.email,
                name: null,
                passwordHash,
                role: 'student',
            })

            const session = await useAppSession()
            await session.update(toSessionUser(user))

            return { success: true, state: AUTH.SIGNUP_SUCCESS }
        } catch (err) {
            console.error('Signup error:', err)
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
