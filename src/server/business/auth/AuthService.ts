import { db } from '../../database/client'
import { users } from '../../database/schemas/users'
import { eq } from 'drizzle-orm'
import { getSession } from '../../utils/session' // 从 session.ts 获取当前会话

export class AuthService {
    static async getCurrentUser(event: any) {
        try {
            // 从 cookie 中获取 session
            const session = await getSession(event)
            if (!session) return null

            // 2. 根据 userId 查询用户
            const user = await db.query.users.findFirst({
                where: eq(users.id, session.userId),
                columns: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    createdAt: true
                }
            })

            return user
        } catch (error) {
            console.error('Get current user error:', error)
            return null
        }
    }

    // 其他认证方法...
    static async login(credentials: { email: string; password: string }) { ... }
    static async logout(event: any) { ... }
    static async signup(data: any) { ... }
}