import { createHash } from 'node:crypto'
import { and, asc, eq, ilike, inArray, ne } from 'drizzle-orm'
import { db, type DbTransaction } from '../database/client'
import { groupMembers, groupPosts, groups, notifications, users } from '../database/schemas'
import { AuthService } from './AuthService'
import { mentionedUserIds } from '@shared/mentions'

export class MentionService {
    static async candidates(data: { groupId: string; search: string }) {
        const current = await AuthService.getCurrentUser()
        if (!current.success || !current.data) throw new Error('请先登录')
        const [member] = await db.select({ id: groupMembers.id }).from(groupMembers).where(and(
            eq(groupMembers.groupId, data.groupId), eq(groupMembers.userId, current.data.id), eq(groupMembers.status, 'approved')))
        if (!member) throw new Error('只有群内成员可以查看可提及的成员')
        return db.select({ id: users.id, name: users.name }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId))
            .where(and(eq(groupMembers.groupId, data.groupId), eq(groupMembers.status, 'approved'), eq(users.isActive, true),
                ne(users.id, current.data.id), data.search ? ilike(users.name, `%${data.search.replace(/[\\%_]/g, '\\$&')}%`) : undefined))
            .orderBy(asc(users.name), asc(users.id)).limit(20)
    }

    /** Content and notifications commit together; one notification per recipient and content item. */
    static async notify(data: { postId: string; replyId?: string; actorId: string; actorName: string | null; content: string }, tx: DbTransaction) {
        const ids = mentionedUserIds(data.content).filter(id => id !== data.actorId)
        if (!ids.length) return
        if (ids.length > 20) throw new Error('每条内容最多提及 20 名成员')
        const [post] = await tx.select({ groupId: groupPosts.groupId, slug: groups.slug, groupName: groups.name })
            .from(groupPosts).innerJoin(groups, eq(groups.id, groupPosts.groupId)).where(eq(groupPosts.id, data.postId))
        if (!post) return
        const [actor] = await tx.select({ id: groupMembers.id }).from(groupMembers).where(and(
            eq(groupMembers.groupId, post.groupId), eq(groupMembers.userId, data.actorId), eq(groupMembers.status, 'approved')))
        if (!actor) return
        const recipients = await tx.select({ id: users.id }).from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId))
            .where(and(eq(groupMembers.groupId, post.groupId), eq(groupMembers.status, 'approved'), eq(users.isActive, true), inArray(users.id, ids)))
        for (const recipient of recipients) {
            const hash = createHash('sha256').update(JSON.stringify(['mention-v1', data.replyId || data.postId, recipient.id])).digest('hex')
            const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
            await tx.insert(notifications).values({ id, userId: recipient.id, type: 'group_mention', title: '有人在群组中提到了你',
                content: `${data.actorName || '群组成员'} 在「${post.groupName}」的${data.replyId ? '回复' : '帖子'}中 @了你。`,
                href: `/groups/${post.slug}/posts/${data.postId}${data.replyId ? `?mentionReply=${data.replyId}#mention-reply-${data.replyId}` : ''}`,
            }).onConflictDoNothing({ target: notifications.id })
        }
    }
}
