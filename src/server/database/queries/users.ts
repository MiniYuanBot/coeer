import { eq, like, and, count, inArray, ilike, SQL } from 'drizzle-orm'
import { db } from '../client'
import { type DbUser, type NewDbUser, users } from '../schemas'
import { UserRole } from '@shared/constants'
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
        const [user] = await db.insert(users).values(data).returning()
        return user
    },

    // Update user basic info
    async update(data: UpdateUserInput): Promise<DbUser> {
        const [user] = await db
            .update(users)
            .set(data)
            .where(eq(users.id, data.id))
            .returning()
        return user
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