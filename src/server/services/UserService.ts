import { userQueries } from '../database/queries'
import { AuthService } from './AuthService'
import type { UserStats } from '@shared/contracts'

export class UserService {
    static async getStats(): Promise<UserStats> {
        const payload = await AuthService.getCurrentUser()
        const user = payload.data
        if (!payload.success || !user || user.role !== 'admin') {
            throw new Error('Permission denied')
        }

        const users = await userQueries.list({ limit: 1000, offset: 0 })
        return {
            total: users.length,
            active: users.filter((item) => item.isActive).length,
            inactive: users.filter((item) => !item.isActive).length,
            students: users.filter((item) => item.role === 'student').length,
            moderators: users.filter((item) => item.role === 'moderator').length,
            admins: users.filter((item) => item.role === 'admin').length,
            users: users.map((item) => ({
                id: item.id,
                email: item.email,
                role: item.role,
                createdAt: item.createdAt,
                name: item.name,
                isActive: item.isActive,
            })),
        }
    }
}
