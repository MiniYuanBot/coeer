import { eq } from 'drizzle-orm'
import { db } from '../client'
import { type DbUser, type NewDbUser, users } from '../schemas'

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

    // update (id: string, data: Partial<User>): Promise<User> {
    //     const [user] = await db.update(users)
    //         .set(data)
    //         .where(eq(users.id, id))
    //         .returning()
    //     return user
    // },
}