// src/services/session.server.ts
import { useSession } from '@tanstack/react-start/server'
import type { User } from '../database/schemas'

type SessionUser = {
  userEmail: User['email']
}

export function useAppSession() {
  const secret = process.env.SESSION_SECRET
  
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required')
  }
  
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long')
  }
  
  return useSession<SessionUser>({
    password: secret
  })
}
