import { bulletinQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { BULLETIN } from '@shared/constants'
import { sql } from 'drizzle-orm'
import { db } from '../database/client'
import type {
    BulletinIdInput,
    BulletinResponse,
    BulletinWithSource,
    CreateBulletinInput,
    ListBulletinsInput,
    PaginatedBulletinResponse,
    UpdateBulletinInput,
} from '@shared/contracts'

export class BulletinService {
    private static async ensureAdmin() {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user) return { ok: false as const, state: BULLETIN.UNAUTHORIZED }
        if (user.role !== 'admin') return { ok: false as const, state: BULLETIN.FORBIDDEN }
        return { ok: true as const, user }
    }

    static async create(data: CreateBulletinInput): Promise<BulletinResponse<BulletinWithSource>> {
        const auth = await this.ensureAdmin()
        if (!auth.ok) return { success: false, state: auth.state }
        try {
            return await db.transaction(async (tx) => {
                // Serialize pin changes, including concurrent creates and edits.
                await tx.execute(sql`select pg_advisory_xact_lock(hashtext('coeer:bulletin-pins'))`)
                if (data.isPinned && await bulletinQueries.count({ isPinned: true, limit: 1, offset: 0 }, tx) >= 5) {
                    return { success: false, state: BULLETIN.PIN_LIMIT_REACHED }
                }
                const bulletin = await bulletinQueries.create(data, tx)
                return { success: true, data: bulletin, state: BULLETIN.CREATE_SUCCESS }
            })
        } catch (err) {
            console.error('Create bulletin error:', err)
            return { success: false, state: BULLETIN.SERVER_ERROR }
        }
    }

    static async list(data: ListBulletinsInput): Promise<PaginatedBulletinResponse<BulletinWithSource>> {
        const items = await bulletinQueries.list(data)
        const total = await bulletinQueries.count(data)
        return { success: true, data: { items, total, limit: data.limit, offset: data.offset }, state: BULLETIN.GET_SUCCESS }
    }

    static async getById(data: BulletinIdInput): Promise<BulletinResponse<BulletinWithSource>> {
        const bulletin = await bulletinQueries.findById(data)
        if (!bulletin) return { success: false, state: BULLETIN.NOT_FOUND }
        return { success: true, data: bulletin, state: BULLETIN.GET_SUCCESS }
    }

    static async update(data: UpdateBulletinInput): Promise<BulletinResponse<void>> {
        const auth = await this.ensureAdmin()
        if (!auth.ok) return { success: false, state: auth.state }
        return db.transaction(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext('coeer:bulletin-pins'))`)
            const existing = await bulletinQueries.findById({ id: data.id }, tx)
            if (!existing) return { success: false, state: BULLETIN.NOT_FOUND }
            if (data.isPinned && !existing.isPinned && await bulletinQueries.count({ isPinned: true, limit: 1, offset: 0 }, tx) >= 5) {
                return { success: false, state: BULLETIN.PIN_LIMIT_REACHED }
            }
            await bulletinQueries.update(data, tx)
            return { success: true, state: BULLETIN.UPDATE_SUCCESS }
        })
    }

    static async delete(data: BulletinIdInput): Promise<BulletinResponse<void>> {
        const auth = await this.ensureAdmin()
        if (!auth.ok) return { success: false, state: auth.state }
        await bulletinQueries.delete(data)
        return { success: true, state: BULLETIN.DELETE_SUCCESS }
    }
}

