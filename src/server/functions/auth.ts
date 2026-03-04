import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useAppSession } from '~/utils/session'
import { AuthService } from '~/services'
import { loginSchema, signupSchema } from '@shared/contracts'

export const fetchUserFn = createServerFn({ method: 'GET' })
    .handler(async () => {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload || !user) {
            return null
        }

        return user
    })

export const loginFn = createServerFn({ method: 'POST' })
    .inputValidator(loginSchema)
    .handler(async ({ data }) => AuthService.login(data))

export const signupFn = createServerFn({ method: 'POST' })
    .inputValidator(signupSchema)
    .handler(async ({ data }) => {
        const result = await AuthService.signup({
            email: data.email,
            password: data.password
        })

        if (!result.success) {
            return result
        }

        throw redirect({ to: data.redirectUrl || '/' })
    })

export const logoutFn = createServerFn().handler(async () => {
    const session = await useAppSession()

    session.clear()

    throw redirect({ to: '/' })
})