// server only
import { useSession } from '@tanstack/react-start/server'
import type { DbUser } from '../database/schemas'
import { env } from '../config'

type SessionUser = {
  userEmail: DbUser['email']
  userRole: DbUser['role']
  userName: DbUser['name']
  lastUpdated: number
}

export function useAppSession() {
  return useSession<SessionUser>({
    password: env.SESSION_SECRET
  })
}
