import { UserRole } from '../constants'
import { ActionResponse } from './action'

export type SessionUser = {
    id: string
    email: string
    role: UserRole
    name: string | null
    lastUpdated: number
}

export type SessionUserStatus =
    | 'GET_ERROR'
    | 'GET_SUCCESS'
    | 'SERVER_ERROR'

export type SessionUserResponse = ActionResponse<SessionUser, SessionUserStatus>
