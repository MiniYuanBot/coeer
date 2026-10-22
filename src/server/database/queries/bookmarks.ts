import { and, count, desc, eq, getTableColumns, inArray, or, sql } from 'drizzle-orm'
import { db } from '../client'
import { bookmarks, groupMembers, groupPosts, groups, users } from '../schemas'
import type { ListBookmarksInput, SetBookmarkInput } from '@shared/contracts/bookmarks'

export const bookmarkQueries = {
    async set(userId: string, data: SetBookmarkInput) {
        if (data.bookmarked) {
            await db.insert(bookmarks).values({ userId, postId: data.postId }).onConflictDoNothing()
        } else {
            await db.delete(bookmarks).where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, data.postId)))
        }
        return { bookmarked: data.bookmarked }
    },
    async summarizePosts(ids: string[], userId?: string) {
        if (!ids.length || !userId) return new Set<string>()
        const rows = await db.select({ postId: bookmarks.postId }).from(bookmarks)
            .where(and(eq(bookmarks.userId, userId), inArray(bookmarks.postId, ids)))
        return new Set(rows.map((row) => row.postId))
    },
    async list(user: { id: string; role: string }, data: ListBookmarksInput) {
        // Apply visibility before pagination/counting, including after leaving a private group.
        const visible = user.role === 'admin' ? sql`true` : or(
            and(eq(groups.status, 'approved'), eq(groups.isPublic, true)),
            sql`exists (select 1 from ${groupMembers} where ${groupMembers.groupId} = ${groups.id}
                and ${groupMembers.userId} = ${user.id} and ${groupMembers.status} = 'approved')`,
        )
        const where = and(eq(bookmarks.userId, user.id), visible)
        const items = await db.select({ savedAt: bookmarks.createdAt, post: getTableColumns(groupPosts),
            group: { id: groups.id, name: groups.name, slug: groups.slug },
            author: { id: users.id, name: users.name },
        }).from(bookmarks).innerJoin(groupPosts, eq(bookmarks.postId, groupPosts.id))
            .innerJoin(groups, eq(groupPosts.groupId, groups.id)).leftJoin(users, eq(groupPosts.authorId, users.id))
            .where(where).orderBy(desc(bookmarks.createdAt), desc(bookmarks.postId)).limit(data.limit).offset(data.offset)
        const [total] = await db.select({ value: count() }).from(bookmarks)
            .innerJoin(groupPosts, eq(bookmarks.postId, groupPosts.id)).innerJoin(groups, eq(groupPosts.groupId, groups.id)).where(where)
        return { items, total: total.value, ...data }
    },
}
