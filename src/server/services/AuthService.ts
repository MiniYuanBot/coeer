import { useAppSession } from '../utils/session'
import { userQueries } from '../database/queries/users'
import { verifyPassword, hashPassword } from '../utils/password'
import type {
    LoginInput, SignupInput, LoginResponse, SignupResponse, LogoutResponse, SessionUserResponse
} from '@shared/contracts'


export class AuthService {
    static async getCurrentUser(): Promise<SessionUserResponse> {
        try {
            const session = await useAppSession()

            if (!session.data?.id || !session.data?.email || !session.data?.role || !session.data?.lastUpdated) {
                return { success: false, status: 'GET_ERROR' }
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
                status: 'GET_SUCCESS'
            }
        } catch (err) {
            return { success: false, status: 'SERVER_ERROR' }
        }
    }

    static async login(data: LoginInput): Promise<LoginResponse<void>> {
        try {
            const user = await userQueries.findByEmail(data.email)

            if (!user) {
                return { success: false, status: 'USER_NOT_FOUND', message: 'User not found' }
            }

            const isValid = await verifyPassword(data.password, user.passwordHash)

            if (!isValid) {
                return { success: false, status: 'INVALID_PASSWORD', message: 'Incorrect password' }
            }

            const session = await useAppSession()
            await session.update({
                id: user.id,
                email: user.email,
                role: user.role,
                name: user.name,
                lastUpdated: Date.now()
            })

            return {
                success: true, status: 'LOGIN_SUCCESS', message: 'Login successful'
            }
        } catch (err) {
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }

    static async signup(data: SignupInput): Promise<SignupResponse<void>> {
        try {
            const existing = await userQueries.findByEmail(data.email)

            if (existing) {
                const isValid = await verifyPassword(data.password, existing.passwordHash)

                if (!isValid) {
                    return { success: false, status: 'EMAIL_EXISTS', message: 'User already exists' }
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
                    status: 'AUTO_LOGIN',
                    message: 'Password correct, login automatically'
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

            return {
                success: true,
                status: 'SIGNUP_SUCCESS',
                message: 'Signup successful'
            }
        } catch (err) {
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }

    static async logout(): Promise<LogoutResponse<void>> {
        try {
            const session = await useAppSession()
            await session.clear()
            return { success: true, status: 'LOGOUT_SUCCESS', message: 'Logout successful' }
        } catch (err) {
            return { success: false, status: 'SERVER_ERROR', message: 'Server error, please try again' }
        }
    }
}