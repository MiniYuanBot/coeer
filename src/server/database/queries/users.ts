import { eq, like, and, sql, count } from 'drizzle-orm'
import { db } from '../client'
import { type DbUser, type NewDbUser, users } from '../schemas'
import { UserRole } from '@shared/constants'

// All user here refers to DbUser, namely with sensitive info
export const userQueries = {
    // Create user
    async create(data: NewDbUser): Promise<DbUser> {
        const [user] = await db.insert(users).values(data).returning()
        return user
    },

    // Delete user
    async delete(id: string): Promise<void> {
        await db.delete(users).where(eq(users.id, id))
    },

    // Find user by its id
    async findById(id: string): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
        })
        return user
    },

    // Find user by its email
    async findByEmail(email: string): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        })
        return user
    },

    // Find user by student ID (for binding verification)
    // async findByStudentId(studentId: string): Promise<DbUser | undefined> {
    //     const user = await db.query.users.findFirst({
    //         where: eq(users.studentId, studentId),
    //     })
    //     return user
    // },

    // Find user with profile (for personal homepage)
    async findWithProfile(id: string): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, id),
            with: {
                profile: true,
            },
        })
        return user
    },

    // Update user basic info
    async update(id: string, data: Partial<NewDbUser>): Promise<DbUser> {
        const [user] = await db
            .update(users)
            .set(data)
            .where(eq(users.id, id))
            .returning()
        return user
    },

    // Atomically update user points balance (within transaction)
    // async updatePoints(id: string, amount: number): Promise<DbUser> {
    //     const [user] = await db
    //         .update(users)
    //         .set({
    //             points: sql`${users.points} + ${amount}`,
    //         })
    //         .where(eq(users.id, id))
    //         .returning()
    //     return user
    // },

    // Paginated list of users by role with optional search
    async listByRole(
        role: UserRole,
        params: {
            limit?: number
            offset?: number
            search?: string
        } = {}
    ): Promise<DbUser[]> {
        const { limit = 20, offset = 0, search } = params

        const conditions = [eq(users.role, role)]

        if (search) {
            conditions.push(
                like(users.name, `%${search}%`)
            )
        }

        const userList = await db.query.users.findMany({
            where: and(...conditions),
            limit,
            offset,
            with: {
                profile: true,
            },
        })

        return userList
    },

    // Count users by role with optional search filter
    async countByRole(
        role: UserRole,
        search?: string
    ): Promise<number> {
        const conditions = [eq(users.role, role)]

        if (search) {
            conditions.push(
                like(users.name, `%${search}%`)
            )
        }

        const [result] = await db
            .select({ count: count() })
            .from(users)
            .where(and(...conditions))

        return result?.count ?? 0
    },
}