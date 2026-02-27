// groupPostQueries.ts
import { db } from '../client'
import { groupPosts, users, groups } from '../schemas'
import { eq, desc, and, or, inArray, count, asc, SQL, isNull } from 'drizzle-orm'
import type { NewGroupPost, GroupPost } from '../schemas'
import { GroupPostWithAuthor, GroupPostWithGroup } from '@shared/contracts'
import { GroupPostType } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    groupId?: string
    authorId?: string
    type?: GroupPostType
    isPinned?: boolean
    id?: string
}): SQL | undefined {
    const { groupId, authorId, type, isPinned, id } = params
    const conditions: SQL[] = []

    if (id) {
        conditions.push(eq(groupPosts.id, id))
    }

    if (groupId) {
        conditions.push(eq(groupPosts.groupId, groupId))
    }

    if (authorId) {
        conditions.push(eq(groupPosts.authorId, authorId))
    }

    if (type) {
        conditions.push(eq(groupPosts.type, type))
    }

    if (isPinned !== undefined) {
        conditions.push(eq(groupPosts.isPinned, isPinned))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

export const groupPostQueries = {
    // Create a post
    async create(data: NewGroupPost): Promise<GroupPost> {
        const [post] = await db.insert(groupPosts).values(data).returning()
        return post
    },

    // Find a post by its id
    async findById(id: string): Promise<GroupPost | undefined> {
        const [post] = await db
            .select()
            .from(groupPosts)
            .where(eq(groupPosts.id, id))
        return post
    },

    // Find a post with author by its id
    async findByIdWithAuthor(id: string): Promise<GroupPostWithAuthor | undefined> {
        const [post] = await db.query.groupPosts.findMany({
            where: eq(groupPosts.id, id),
            with: {
                author: {
                    columns: { id: true, name: true, avatarUrl: true },
                },
            },
            limit: 1,
        })

        return post as GroupPostWithAuthor | undefined
    },

    // Find all posts by group id with optional filters
    async findByGroup(
        groupId: string,
        params: {
            type?: GroupPostType
            isPinned?: boolean
            limit?: number
            offset?: number
        }
    ): Promise<GroupPostWithAuthor[]> {
        const { type, isPinned, limit = 20, offset = 0 } = params

        return db.query.groupPosts.findMany({
            where: buildWhereClause({ groupId, type, isPinned }),
            with: {
                author: {
                    columns: { id: true, name: true, avatarUrl: true },
                },
            },
            orderBy: [
                desc(groupPosts.isPinned), // pinned post first
                desc(groupPosts.createdAt),
            ],
            limit,
            offset,
        }) as Promise<GroupPostWithAuthor[]>
    },

    // Find all posts by author id with optional filters
    async findByAuthor(
        authorId: string,
        params: {
            limit?: number
            offset?: number
        }
    ): Promise<GroupPostWithGroup[]> {
        const { limit = 20, offset = 0 } = params

        return db.query.groupPosts.findMany({
            where: eq(groupPosts.authorId, authorId),
            with: {
                group: {
                    columns: { id: true, name: true, slug: true },
                },
            },
            orderBy: [desc(groupPosts.createdAt)],
            limit,
            offset,
        }) as Promise<GroupPostWithGroup[]>
    },

    // Update content of post
    async update(id: string, data: Partial<NewGroupPost>): Promise<GroupPost> {
        const [post] = await db
            .update(groupPosts)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(groupPosts.id, id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }

        return post
    },

    // Pin/Unpin the post
    async togglePin(id: string, isPinned: boolean): Promise<GroupPost> {
        const [post] = await db
            .update(groupPosts)
            .set({
                isPinned,
                updatedAt: new Date(),
            })
            .where(eq(groupPosts.id, id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }

        return post
    },

    // Delete the post
    async delete(id: string): Promise<GroupPost> {
        const [post] = await db
            .delete(groupPosts)
            .where(eq(groupPosts.id, id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }

        return post
    },

    // Count posts by group id with optional filters
    async countByGroup(
        groupId: string,
        params: {
            type?: GroupPostType
            authorId?: string
            isPinned?: boolean
        }
    ): Promise<number> {
        const { type, authorId, isPinned } = params

        const [result] = await db
            .select({ value: count() })
            .from(groupPosts)
            .where(buildWhereClause({ groupId, type, authorId, isPinned }))

        return result?.value ?? 0
    },

    // Count posts by authorId id with optional filters
    async countByAuthor(
        authorId: string,
        params: {
            type?: GroupPostType
            isPinned?: boolean
        }
    ): Promise<number> {
        const { type, isPinned } = params

        const [result] = await db
            .select({ value: count() })
            .from(groupPosts)
            .where(buildWhereClause({ authorId, type, isPinned }))
        return result?.value ?? 0
    },

    // Check if post exists
    async existsInGroup(id: string, groupId: string): Promise<boolean> {
        const [post] = await db
            .select({ id: groupPosts.id })
            .from(groupPosts)
            .where(
                and(
                    eq(groupPosts.id, id),
                    eq(groupPosts.groupId, groupId)
                )
            )
            .limit(1)

        return !!post
    },

    // Check if user is author
    async isAuthor(id: string, authorId: string): Promise<boolean> {
        const [post] = await db
            .select({ id: groupPosts.id })
            .from(groupPosts)
            .where(
                and(
                    eq(groupPosts.id, id),
                    eq(groupPosts.authorId, authorId)
                )
            )
            .limit(1)

        return !!post
    },
}