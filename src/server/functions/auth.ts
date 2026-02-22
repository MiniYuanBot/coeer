import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useAppSession } from '~/utils/session'
import { AuthService } from '~/services'

export const fetchUserFn = createServerFn({ method: 'GET' })
    .handler(async () => {
        return AuthService.getCurrentUser()
    })

export const loginFn = createServerFn({ method: 'POST' })
    .inputValidator((d: { email: string; password: string }) => d)
    .handler(async ({ data }) => {
        const result = await AuthService.login(data)

        const messageMap = {
            'USER_NOT_FOUND': 'User not found',
            'INVALID_PASSWORD': 'Incorrect password',
            'SERVER_ERROR': 'Server error, please try again',
            'LOGIN_SUCCESS': 'Login successful'
        }

        return {
            success: result.success,
            message: messageMap[result.message]
        }
    })

export const signupFn = createServerFn({ method: 'POST' })
    .inputValidator(
        (d: { email: string; password: string; redirectUrl?: string }) => d,
    )
    .handler(async ({ data }) => {
        const result = await AuthService.signup({
            email: data.email,
            password: data.password
        })

        if (!result.success) {
            return {
                success: false,
                message: result.message === 'EMAIL_EXISTS'
                    ? 'User already exists with different password'
                    : 'Server error, please try again',
            }
        }

        throw redirect({
            href: data.redirectUrl || '/',
        })
    })

export const logoutFn = createServerFn().handler(async () => {
    const session = await useAppSession()

    session.clear()

    throw redirect({
        href: '/',
    })
})