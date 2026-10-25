import { eq, like, and, count, inArray, ilike, SQL } from 'drizzle-orm'
import { db } from '../client'
import { type DbUser, type NewDbUser, users } from '../schemas'
import { UserRole } from '@shared/constants'
import { usernameSchema } from '@shared/contracts/unicode'
import { isUsernameConflict } from '../../utils/username-conflict'
import { randomUUID } from 'node:crypto'
import {
    EmailInput,
    UpdateUserInput,
    UserIdInput,
    ListUsersInput,
    CountUsersInput,
    UsersWithProfile,
} from '@shared/contracts/users'

// Private query condition builder
function buildWhereClause(params: {
    id?: string
    role?: UserRole | UserRole[]
    search?: string
}): SQL | undefined {
    const { id, role, search } = params
    const conditions: SQL[] = []

    if (id) {
        conditions.push(eq(users.id, id))
    }

    if (role) {
        if (Array.isArray(role)) {
            conditions.push(inArray(users.role, role))
        } else {
            conditions.push(eq(users.role, role))
        }
    }

    if (search) {
        const searchCondition = ilike(users.name, `%${search}%`)
        if (searchCondition) {
            conditions.push(searchCondition)
        }
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

// All user here refers to DbUser, namely with sensitive info
export const userQueries = {
    // Create user
    async create(data: NewDbUser): Promise<DbUser> {
        if (data.name != null) data = { ...data, name: usernameSchema.parse(data.name) }
        const [user] = await db.insert(users).values(data).returning()
        return user
    },

    // A student ID may already be somebody else's nickname. Keep email signup working.
    async createWithDefaultName(data: NewDbUser): Promise<DbUser> {
        const id = data.id ?? randomUUID()
        const base = usernameSchema.parse(data.name)
        for (let attempt = 0; attempt < 10; attempt++) {
            const name = attempt === 0 ? base : `${Array.from(base).slice(0, 20).join('')}-${randomUUID()}`
            try { return await userQueries.create({ ...data, id, name }) }
            catch (error) { if (!isUsernameConflict(error)) throw error }
        }
        throw new Error('暂时无法分配昵称，请重试')
    },

    // Update user basic info
    async update(data: UpdateUserInput): Promise<DbUser> {
        if (data.name !== undefined) data = { ...data, name: usernameSchema.parse(data.name) }
        const [user] = await db
            .update(users)
            .set(data)
            .where(eq(users.id, data.id))
            .returning()
        return user
    },

    // Compare-and-swap prevents concurrent password changes from accepting a stale password.
    async changePassword(data: { id: string; currentPasswordHash: string; passwordHash: string }): Promise<boolean> {
        const result = await db.update(users)
            .set({ passwordHash: data.passwordHash, updatedAt: new Date() })
            .where(and(eq(users.id, data.id), eq(users.passwordHash, data.currentPasswordHash), eq(users.isActive, true)))
            .returning({ id: users.id })
        return result.length === 1
    },

    // Delete user
    async delete(data: UserIdInput): Promise<void> {
        await db.delete(users).where(eq(users.id, data.id))
    },

    // Find user by its id
    async findById(data: UserIdInput): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, data.id),
        })
        return user
    },

    // Find user by its email
    async findByEmail(data: EmailInput): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.email, data.email),
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
    async findWithProfile(data: UserIdInput): Promise<DbUser | undefined> {
        const user = await db.query.users.findFirst({
            where: eq(users.id, data.id),
            with: {
                profile: true,
            },
        })
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

    // Paginated list of users with optional search
    async list(data: ListUsersInput): Promise<UsersWithProfile[]> {
        const { limit, offset, search, role } = data

        const userList = await db.query.users.findMany({
            where: buildWhereClause({ role, search }),
            limit,
            offset,
            with: {
                profile: true,
            },
        })

        return userList
    },

    // Count users with optional search filter
    async count(data: CountUsersInput): Promise<number> {
        const [result] = await db
            .select({ count: count() })
            .from(users)
            .where(buildWhereClause(data))

        return result?.count ?? 0
    },
}
