import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { verifyPassword, hashPassword } from '~/utils/password'
import { useAppSession } from '~/utils/session'
import { userQueries } from '~/database/queries'


export const signupFn = createServerFn({ method: 'POST' })
    .inputValidator(
        (d: { email: string; password: string; redirectUrl?: string }) => d,
    )
    .handler(async ({ data }) => {
        // Check if the user already exists
        const found = await userQueries.findByEmailInternal(data.email)

        // Create a session
        const session = await useAppSession()

        if (found) {
            const isPasswordValid = await verifyPassword(data.password, found.passwordHash)

            if (!isPasswordValid) {
                return {
                    error: true,
                    userExists: true,
                    message: 'User already exists',
                }
            }

            // Store the user's email in the session
            await session.update({
                userEmail: found.email,
            })

            // Redirect to the prev page stored in the "redirect" search param
            throw redirect({
                href: data.redirectUrl || '/',
            })
        }

        // Encrypt the password using Sha256 into plaintext
        const passwordHash = await hashPassword(data.password)

        // Create the user
        const user = await userQueries.create({
            email: data.email,
            passwordHash: passwordHash,
        })

        // Store the user's email in the session
        await session.update({
            userEmail: user.email,
        })

        // Redirect to the prev page stored in the "redirect" search param
        throw redirect({
            href: data.redirectUrl || '/',
        })
    })