import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from 'src/server/utils/drizzle'
import { users } from 'src/server/database/schemas/users'
import { verifyPassword } from 'src/server/utils/auth'
import { Login } from 'src/app/components/Login'
import { useAppSession } from 'src/server/utils/session'

export const loginFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    // Find the user using Drizzle
    const user = await db.query.users.findFirst({
      where: eq(users.email, data.email),
    })

    // Check if the user exists
    if (!user) {
      return {
        error: true,
        userNotFound: true,
        message: 'User not found',
      }
    }

    // Check if the password is correct using the verify function
    const isPasswordValid = await verifyPassword(data.password, user.password)

    if (!isPasswordValid) {
      return {
        error: true,
        message: 'Incorrect password',
      }
    }

    // Create a session
    const session = await useAppSession()

    // Store the user's email in the session
    await session.update({
      userEmail: user.email,
    })
  })

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      throw new Error('Not authenticated')
    }
  },
  errorComponent: ({ error }) => {
    if (error.message === 'Not authenticated') {
      return <Login />
    }

    throw error
  },
})