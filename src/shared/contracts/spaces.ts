import { z } from 'zod'
import type { Booking, BookingPermission, Space, User } from '../open-space/domain'

export const spaceSearchSchema = z.object({
    date: z.string().optional(),
    next: z.string().optional(),
    q: z.string().catch('').default(''),
    module: z.enum(['all', 'meeting', 'activity']).catch('all').default('all'),
    capacity: z.coerce.number().int().min(0).max(1000).catch(0).default(0),
    page: z.coerce.number().int().min(1).catch(1).default(1),
})
export type SpaceConfig = {
    adapter: string
    demo: boolean
    paused: boolean
    horizon: number
    syncEnabled: boolean
    writesEnabled: boolean
    environment: 'mock' | 'staging' | 'production'
    registrationEnabled: boolean
}
export type SpaceSession = { user: User | null; csrf: string | null }
export type SpaceAdminData = {
    allowlist: {
        studentId: string
        name: string
        updatedAt: number
        bookingPermission: BookingPermission
        passwordIsDefault: boolean
    }[]
    spaces: Space[]
    bookings: Booking[]
    paused: boolean
    adapter: string
    environment: string
    scenarios: { space_id: string; scenario: string }[]
    mockSyncFailure: boolean
    syncEnabled: boolean
    bookingEnabled: boolean
    operations: { queuePending: number; manualReview: number; syncStale: boolean }
    alerts: { id: number; code: string; occurrences: number; last_at: number; ack_at: number | null }[]
    adapterDiagnostics: {
        writeConfigured?: boolean
        catalogComplete?: boolean
        identifiedSpaces?: number
        unresolvedSpaces?: number
        lastError?: string | null
        connector?: {
            authentication?: string
            lastSuccessAt?: number | null
            expiresAt?: number | null
            recoveryRequired?: boolean
        }
    }
}
export type SpaceHistoryEntry = {
    id: string | number
    status?: string
    state?: string
    type?: string
    started_at?: number
    finished_at?: number | null
    snapshot_count?: number
    booking_id?: string | null
    run_at?: number
    attempts?: number
    error_code?: string | null
    actor?: string
    actor_name?: string | null
    action?: string
    entity_id?: string
    detail?: string
    at?: number
}
export type SpaceHistoryPage = { items: SpaceHistoryEntry[]; total: number; page: number; size: number }
