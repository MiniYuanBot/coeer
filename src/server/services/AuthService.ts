import { useAppSession } from '../utils/session'
import { userQueries } from '../database/queries/users'
import { verifyPassword, hashPassword } from '../utils/password'
import type {
    LoginInput, SignupInput, LoginResponse, SignupResponse, LogoutResponse, SessionUserResponse, SessionUser
} from '@shared/contracts'
import { AUTH } from '@shared/constants'


export class AuthService {
    static async getCurrentUser(): Promise<SessionUserResponse<SessionUser>> {
        try {
            const session = await useAppSession()

            if (!session.data?.id || !session.data?.email || !session.data?.role || !session.data?.lastUpdated) {
                return { success: false, state: AUTH.UNAUTHORIZED }
            }

            return {
                success: true,
                data: {
                    id: session.data.id,
                    email: session.data.email,
                    name: session.data.name ?? null,
                    role: session.data.role,
                    lastUpdated: session.data.lastUpdated
                },
                state: AUTH.GET_SUCCESS
            }
        } catch (err) {
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async login(data: LoginInput): Promise<LoginResponse<void>> {
        try {
            const user = await userQueries.findByEmail(data.email)

            if (!user) {
                return { success: false, state: AUTH.NOT_FOUND }
            }

            const isValid = await verifyPassword(data.password, user.passwordHash)

            if (!isValid) {
                return { success: false, state: AUTH.INVALID_PASSWORD }
            }

            const session = await useAppSession()
            await session.update({
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                lastUpdated: Date.now()
            })

            return { success: true, state: AUTH.LOGIN_SUCCESS }
        } catch (err) {
            return { success: false, state: AUTH.SERVER_ERROR }
        }
    }

    static async signup(data: SignupInput): Promise<SignupResponse<void>> {
        try {
            const existing = await userQueries.findByEmail(data.email)

            if (existing) {
                const isValid = await verifyPassword(data.password, existing.passwordHash)

                if (!isValid) {
                    return { success: false, state: AUTH.ALREADY_EXISTS }
                }

                // If password matched, login automatically
                const session = await useAppSession()
                await session.update({
                    id: existing.id,
                    email: existing.email,
                    role: existing.role,
                    name: existing.name,
                    lastUpdated: Date.now()
                })

                return {
                    success: true,
                    state: { ...AUTH.LOGIN_SUCCESS, message: 'Password correct, login automatically' },
                }
            }

            const passwordHash = await hashPassword(data.password)
            const user = await userQueries.create({
                email: data.email,
                name: null,
                passwordHash,
                role: 'student'
            })

            const session = await useAppSession()
            await session.update({
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                lastUpdated: Date.now()
            })

            return { success: true, state: AUTH.SIGNUP_SUCCESS }
        } catch (err) {
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