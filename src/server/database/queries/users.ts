import { eq } from 'drizzle-orm'
import { db } from '../client'
import { type DbUser, type NewDbUser, users } from '../schemas'
import type { User } from '@shared/types'

export const userQueries = {
    // Return DB User with sensitive info
    findByEmailInternal: async (email: string): Promise<DbUser | undefined> => {
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        })
        return user
    },

    // findById: async (id: string): Promise<User | undefined> => {
    //     const user = await db.query.users.findFirst({
    //         where: eq(users.id, id),
    //     })
    //     return user
    // },

    create: async (data: NewDbUser): Promise<User> => {
        const [user] = await db.insert(users).values(data).returning()
        return user
    },

    // update: async (id: string, data: Partial<User>): Promise<User> => {
    //     const [user] = await db.update(users)
    //         .set(data)
    //         .where(eq(users.id, id))
    //         .returning()
    //     return user
    // },

    // delete: async (id: string): Promise<void> => {
    //     await db.delete(users).where(eq(users.id, id))
    // }
}