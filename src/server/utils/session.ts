// server only
import { useSession } from '@tanstack/react-start/server'
import type { DbUser } from '../database/schemas'
import { env } from '../config'

export type SessionUser = {
  userId: DbUser['id']
  userEmail: DbUser['email']
  userRole: DbUser['role']
  userName: DbUser['name']
  lastUpdated: number
}

export function useAppSession() {
  return useSession<SessionUser>({
    name: 'coeer_session',
    password: env.SESSION_SECRET,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    }
  })
}
