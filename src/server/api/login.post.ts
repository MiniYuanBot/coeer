import { createServerFn } from '@tanstack/react-start'
import { verifyPassword } from '~/utils/auth'
import { useAppSession } from '~/utils/session'
import { userQueries } from '~/database/queries'
export const loginFn = createServerFn({ method: 'POST' })
    .inputValidator((d: { email: string; password: string }) => d)
    .handler(async ({ data }) => {
        console.log('loginFn called with email:', data.email); // 添加日志

        try {
            // Find the user using Drizzle
            console.log('Attempting to find user by email:', data.email);
            const user = await userQueries.findByEmailInternal(data.email);
            console.log('Query result - user:', user); // 查看返回结果

            // Check if the user exists
            if (!user) {
                console.log('User not found for email:', data.email);
                return {
                    error: true,
                    userNotFound: true,
                    message: 'User not found',
                    success: false
                }
            }

            console.log('User found:', user.email);

            const isPasswordValid = await verifyPassword(data.password, user.passwordHash);
            console.log('Password valid:', isPasswordValid);

            if (!isPasswordValid) {
                return {
                    error: true,
                    message: 'Incorrect password',
                    success: false
                }
            }

            // Create a session
            const session = await useAppSession();
            await session.update({ userEmail: user.email });

            console.log('Login successful for:', user.email);

            return {
                success: true,
                message: 'Login successful',
                error: false
            }

        } catch (error) {
            console.error('Error in loginFn:', error);
            return {
                error: true,
                message: 'Server error',
                success: false
            }
        }
    })