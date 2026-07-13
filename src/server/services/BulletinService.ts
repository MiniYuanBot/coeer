import { bulletinQueries } from '../database/queries'
import { AuthService } from './AuthService'
import { BULLETIN } from '@shared/constants'
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
            const bulletin = await bulletinQueries.create(data)
            return { success: true, data: bulletin, state: BULLETIN.CREATE_SUCCESS }
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
        await bulletinQueries.update(data)
        return { success: true, state: BULLETIN.UPDATE_SUCCESS }
    }

    static async delete(data: BulletinIdInput): Promise<BulletinResponse<void>> {
        const auth = await this.ensureAdmin()
        if (!auth.ok) return { success: false, state: auth.state }
        await bulletinQueries.delete(data)
        return { success: true, state: BULLETIN.DELETE_SUCCESS }
    }
}

