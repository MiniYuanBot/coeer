import { createServerFn } from '@tanstack/react-start'
import { verifyPassword } from '~/utils/password'
import { useAppSession } from '~/utils/session'
import { userQueries } from '~/database/queries'
export const loginFn = createServerFn({ method: 'POST' })
    .inputValidator((d: { email: string; password: string }) => d)
    .handler(async ({ data }) => {
        try {
            // Find the user using Drizzle
            const user = await userQueries.findByEmailInternal(data.email);

            // Check if the user exists
            if (!user) {
                return {
                    error: true,
                    userNotFound: true,
                    message: 'User not found',
                    success: false
                }
            }

            const isPasswordValid = await verifyPassword(data.password, user.passwordHash);

            if (!isPasswordValid) {
                return {
                    error: true,
                    message: 'Incorrect password',
                    success: false
                }
            }

            // Create a session
            const session = await useAppSession();
            await session.update({
                userEmail: user.email,
                userRole: user.role,
                userName: user.name,
                lastUpdated: Date.now()
            });

            return {
                success: true,
                message: 'Login successful',
                error: false
            }

        } catch (error) {
            return {
                error: true,
                message: 'Server error',
                success: false
            }
        }
    })