// groupPostQueries.ts
import { db } from '../client'
import { groupPosts } from '../schemas'
import { eq, desc, and, count, SQL } from 'drizzle-orm'
import type { NewGroupPost } from '../schemas'
import {
    CountPostsByAuthorInput,
    CountPostsByGroupInput,
    FeedbackIdInput,
    GroupPostWithAuthor,
    GroupPostWithGroup,
    ListPostsByAuthorInput,
    ListPostsByGroupInput,
    PostIdInput,
    TogglePinInput,
    UpdateGroupPostInput,
    CheckGroupInput,
    CheckAuthorInput,
} from '@shared/contracts'
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
    async create(data: NewGroupPost): Promise<void> {
        const [post] = await db.insert(groupPosts).values(data).returning()
        
        if (!post) {
            throw new Error('Create failed')
        }
    },

    // Update content of post
    async update(data: UpdateGroupPostInput): Promise<void> {
        const [post] = await db
            .update(groupPosts)
            .set({
                ...data,
                updatedAt: new Date(),
            })
            .where(eq(groupPosts.id, data.id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }
    },

    // Delete the post
    async delete(data: PostIdInput): Promise<void> {
        const [post] = await db
            .delete(groupPosts)
            .where(eq(groupPosts.id, data.id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }
    },

    // Find a post with author by its id
    async findById(data: FeedbackIdInput): Promise<GroupPostWithAuthor | undefined> {
        const post = await db.query.groupPosts.findFirst({
            where: eq(groupPosts.id, data.id),
            with: {
                author: {
                    columns: { id: true, name: true },
                },
            },
        })

        return post
    },

    // Find all posts by group id with optional filters
    async findByGroup(data: ListPostsByGroupInput): Promise<GroupPostWithAuthor[]> {
        const { groupId, type, isPinned, limit, offset } = data

        return db.query.groupPosts.findMany({
            where: buildWhereClause({ groupId, type, isPinned }),
            with: {
                author: {
                    columns: { id: true, name: true },
                },
            },
            orderBy: [
                desc(groupPosts.isPinned), // pinned post first
                desc(groupPosts.createdAt),
            ],
            limit,
            offset,
        })
    },

    // Find all posts by author id with optional filters
    async findByAuthor(data: ListPostsByAuthorInput): Promise<GroupPostWithGroup[]> {
        const { authorId, limit, offset } = data

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
        })
    },

    // Pin/Unpin the post
    async togglePin(data: TogglePinInput): Promise<void> {
        const [post] = await db
            .update(groupPosts)
            .set({
                isPinned: data.isPinned,
                updatedAt: new Date(),
            })
            .where(eq(groupPosts.id, data.id))
            .returning()

        if (!post) {
            throw new Error('Post not found')
        }
    },

    // Count posts by group id with optional filters
    async countByGroup(data: CountPostsByGroupInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(groupPosts)
            .where(buildWhereClause(data))

        return result?.value ?? 0
    },

    // Count posts by authorId id with optional filters
    async countByAuthor(data: CountPostsByAuthorInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(groupPosts)
            .where(buildWhereClause(data))
        return result?.value ?? 0
    },

    // Check if post exists
    async checkGroup(data: CheckGroupInput): Promise<boolean> {
        const [post] = await db
            .select({ id: groupPosts.id })
            .from(groupPosts)
            .where(buildWhereClause(data))
            .limit(1)

        return !!post
    },

    // Check if user is author
    async checkAuthor(data: CheckAuthorInput): Promise<boolean> {
        const [post] = await db
            .select({ id: groupPosts.id })
            .from(groupPosts)
            .where(buildWhereClause(data))
            .limit(1)

        return !!post
    },
}