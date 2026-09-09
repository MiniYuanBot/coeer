import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useAppSession } from '~/utils/session'
import { AuthService } from '~/services'
import { loginSchema, signupSchema } from '@shared/contracts'

/**
 * Returns the current session user (or null). Used by the root route to
 * seed the router context — never throws, so unauthenticated browsing of
 * public pages stays possible.
 */
export const fetchUserFn = createServerFn({ method: 'GET' })
    .handler(async () => {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) {
            return null
        }
        return user
    })

export const loginFn = createServerFn({ method: 'POST' })
    .inputValidator(loginSchema)
    .handler(async ({ data }) => AuthService.login(data))

/**
 * Signup behaves like login: on success a session is established and the
 * envelope is returned to the client, which then navigates to the guarded
 * `redirect` target (validated client-side as an internal path).
 * The old server-side `redirectUrl` has been removed — it was an
 * open-redirect vector.
 */
export const signupFn = createServerFn({ method: 'POST' })
    .inputValidator(signupSchema)
    .handler(async ({ data }) =>
        AuthService.signup({
            email: data.email,
            password: data.password,
        }),
    )

export const logoutFn = createServerFn()
    .handler(async () => {
        const session = await useAppSession()
        session.clear()
        throw redirect({ to: '/' })
    })
