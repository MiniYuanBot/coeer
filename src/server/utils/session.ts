// src/services/session.server.ts
import { useSession } from '@tanstack/react-start/server'
import type { User } from '../database/schemas'

type SessionUser = {
  userEmail: User['email']
}

export function useAppSession() {
  return useSession<SessionUser>({
    password: process.env.SESSION_SECRET || 'ChangeThisBeforeShippingToProdOrYouWillBeFired',
  })
}
