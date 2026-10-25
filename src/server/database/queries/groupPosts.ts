// groupPostQueries.ts
import { db, type DbExecutor } from '../client'
import { groupPosts, groups, reactions, replies } from '../schemas'
import { eq, desc, and, count, inArray, SQL } from 'drizzle-orm'
import type { NewGroupPost } from '../schemas'
import {
    CountPostsByAuthorInput,
    CountPostsByGroupInput,
    FeedbackIdInput,
    GroupPostWithAuthor,
    GroupPostWithGroup,
    PublicGroupPost,
    ListPostsByAuthorInput,
    ListPostsByGroupInput,
    GroupPostIdInput,
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
    publicOnly?: boolean
}): SQL | undefined {
    const { groupId, authorId, type, isPinned, id } = params
    const conditions: SQL[] = []

    if (params.publicOnly) {
        conditions.push(inArray(groupPosts.groupId, db.select({ id: groups.id }).from(groups)
            .where(and(eq(groups.isPublic, true), eq(groups.status, 'approved')))))
    }

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
    async create(data: NewGroupPost, executor: DbExecutor = db) {
        const [post] = await executor.insert(groupPosts).values(data).returning()
        
        if (!post) {
            throw new Error('Create failed')
        }
        return post
    },

    // Update content of post
    async update(data: UpdateGroupPostInput, executor: DbExecutor = db): Promise<void> {
        const [post] = await executor
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
    async delete(data: GroupPostIdInput): Promise<void> {
        await db.transaction(async (tx) => {
            await tx.delete(replies).where(and(eq(replies.targetType, 'group_post'), eq(replies.targetId, data.id)))
            await tx.delete(reactions).where(and(eq(reactions.targetType, 'group_post'), eq(reactions.targetId, data.id)))
            const [post] = await tx.delete(groupPosts).where(eq(groupPosts.id, data.id)).returning()
            if (!post) throw new Error('Post not found')
        })
    },

    // Find a post with author by its id
    async findById(data: FeedbackIdInput, executor: DbExecutor = db): Promise<GroupPostWithAuthor | undefined> {
        const post = await executor.query.groupPosts.findFirst({
            where: eq(groupPosts.id, data.id),
            with: {
                author: {
                    columns: { id: true, name: true, avatarUrl: true },
                },
            },
        })

        return post
    },

    // Filter all groups before limiting; membership and group pins do not affect this feed.
    async findRecentPublic(): Promise<PublicGroupPost[]> {
        return db.query.groupPosts.findMany({
            where: buildWhereClause({ publicOnly: true }),
            with: {
                author: { columns: { id: true, name: true, avatarUrl: true } },
                group: { columns: { id: true, name: true, slug: true } },
            },
            orderBy: [desc(groupPosts.createdAt), desc(groupPosts.id)],
            limit: 5,
        })
    },

    // Find all posts by group id with optional filters
    async findByGroup(data: ListPostsByGroupInput): Promise<GroupPostWithAuthor[]> {
        const { groupId, type, isPinned, limit, offset } = data

        return db.query.groupPosts.findMany({
            where: buildWhereClause({ groupId, type, isPinned }),
            with: {
                author: {
                    columns: { id: true, name: true, avatarUrl: true },
                },
            },
            orderBy: [
                desc(groupPosts.isPinned), // pinned post first within the group
                desc(groupPosts.createdAt),
                desc(groupPosts.id),
            ],
            limit,
            offset,
        })
    },

    // Find all posts by author id with optional filters
    async findByAuthor(data: ListPostsByAuthorInput): Promise<GroupPostWithGroup[]> {
        const { limit, offset } = data

        return db.query.groupPosts.findMany({
            where: buildWhereClause({ ...data, publicOnly: true }),
            with: {
                group: {
                    columns: { id: true, name: true, slug: true },
                },
            },
            orderBy: [desc(groupPosts.createdAt), desc(groupPosts.id)],
            limit,
            offset,
        })
    },

    // Pin/Unpin the post
    async togglePin(data: TogglePinInput, executor: DbExecutor = db): Promise<void> {
        const [post] = await executor
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
    async countByGroup(data: CountPostsByGroupInput, executor: DbExecutor = db): Promise<number> {
        const [result] = await executor
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
            .where(buildWhereClause({ ...data, publicOnly: true }))
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
