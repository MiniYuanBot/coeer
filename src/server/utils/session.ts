// server only
import { useSession } from '@tanstack/react-start/server'
import type { AppSessionData } from '@shared/contracts'
import { env } from '../config'

export function useAppSession() {
  return useSession<AppSessionData>({
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
