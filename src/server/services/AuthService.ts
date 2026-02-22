import { useAppSession, type SessionUser } from '../utils/session'
import { userQueries } from '../database/queries/users'
import { verifyPassword, hashPassword } from '../utils/password'
import type { DbUser } from '../database/schemas'

export class AuthService {
    static async getCurrentUser(): Promise<Pick<DbUser, 'id' | 'email' | 'name' | 'role'> & { lastUpdated: number } | null> {
        try {
            const session = await useAppSession()

            if (!session.data?.userId || !session.data?.userEmail || !session.data?.userRole) {
                return null
            }

            return {
                id: session.data.userId,
                email: session.data.userEmail,
                name: session.data.userName ?? null,
                role: session.data.userRole,
                lastUpdated: Date.now()
            }
        } catch (err) {
            return null
        }
    }

    static async login(data: { email: string, password: string }): Promise<
        { success: true | false; message: 'USER_NOT_FOUND' | 'INVALID_PASSWORD' | 'SERVER_ERROR' | 'LOGIN_SUCCESS' }
    > {
        try {
            const user = await userQueries.findByEmailInternal(data.email)

            if (!user) {
                return { success: false, message: 'USER_NOT_FOUND' }
            }

            const isValid = await verifyPassword(data.password, user.passwordHash)

            if (!isValid) {
                return { success: false, message: 'INVALID_PASSWORD' }
            }

            const session = await useAppSession()
            await session.update({
                userId: user.id,
                userEmail: user.email,
                userRole: user.role,
                userName: user.name,
                lastUpdated: Date.now()
            })

            return {
                success: true,
                message: 'LOGIN_SUCCESS'
            }
        } catch (err) {
            return { success: false, message: 'SERVER_ERROR' }
        }
    }

    static async signup(data: {
        email: string
        password: string
    }): Promise<
        { success: true | false; message: 'EMAIL_EXISTS' | 'SERVER_ERROR' | 'AUTO_LOGIN' | 'SIGNUP_SUCCESS' }
    > {
        try {
            const existing = await userQueries.findByEmailInternal(data.email)

            if (existing) {
                const isValid = await verifyPassword(data.password, existing.passwordHash)

                if (!isValid) {
                    return { success: false, message: 'EMAIL_EXISTS' }
                }

                // If password matched, login automatically
                const session = await useAppSession()
                await session.update({
                    userId: existing.id,
                    userEmail: existing.email,
                    userRole: existing.role,
                    userName: existing.name,
                    lastUpdated: Date.now()
                })

                return {
                    success: true,
                    message: 'AUTO_LOGIN',
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
                userId: user.id,
                userEmail: user.email,
                userRole: user.role,
                userName: user.name,
                lastUpdated: Date.now()
            })

            return {
                success: true,
                message: 'SIGNUP_SUCCESS'
            }
        } catch (err) {
            return { success: false, message: 'SERVER_ERROR' }
        }
    }

    static async logout(): Promise<{ success: true | false; message: 'SERVER_ERROR' | 'LOGOUT_SUCCESS' }> {
        try {
            const session = await useAppSession()
            await session.clear()
            return { success: true, message: 'LOGOUT_SUCCESS' }
        } catch (err) {
            return { success: false, message: 'SERVER_ERROR' }
        }
    }
}