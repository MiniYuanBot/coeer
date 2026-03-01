// groupMemberQueries.ts
import { db } from '../client'
import { groupMembers } from '../schemas'
import { eq, desc, and, inArray, count, asc, SQL } from 'drizzle-orm'
import type { NewGroupMember, GroupMember } from '../schemas'
import {
    GroupMemberWithUser,
    GroupMemberWithGroup,
    GroupMemberIdInput,
    GroupAndUserInput,
    UpdateGroupMemberInput,
    CountMembersByGroupInput,
    CheckRoleInput,
    ListMembersByGroupInput,
    ListMembersByUserInput,
    CountMembersByUserInput,
} from '@shared/contracts'
import { GroupMemberRole, GroupMemberStatus, GROUP_MEMBER_STATUS } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    groupId?: string
    userId?: string
    status?: GroupMemberStatus | GroupMemberStatus[]
    role?: GroupMemberRole
}): SQL | undefined {
    const { status, role, groupId, userId } = params
    const conditions: SQL[] = []

    if (groupId) {
        conditions.push(eq(groupMembers.groupId, groupId))
    }

    if (userId) {
        conditions.push(eq(groupMembers.userId, userId))
    }

    if (status) {
        if (Array.isArray(status)) {
            conditions.push(inArray(groupMembers.status, status))
        } else {
            conditions.push(eq(groupMembers.status, status))
        }
    }

    if (role) {
        conditions.push(eq(groupMembers.role, role))
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

export const groupMemberQueries = {
    // Join/request to join a group
    async create(data: NewGroupMember): Promise<GroupMember> {
        const [member] = await db.insert(groupMembers).values(data).returning()
        return member
    },

    // Update group member
    async update(data: UpdateGroupMemberInput): Promise<void> {
        await db.update(groupMembers)
            .set({ status: data.status, role: data.role, updatedAt: new Date() })
            .where(eq(groupMembers.id, data.memberId))
    },

    // Remove member / leave group
    async delete(data: GroupMemberIdInput): Promise<void> {
        await db.delete(groupMembers).where(eq(groupMembers.id, data.memberId))
    },

    // Find a membership by its id
    async findById(data: GroupMemberIdInput): Promise<GroupMember | undefined> {
        const [member] = await db.select().from(groupMembers).where(eq(groupMembers.id, data.memberId))
        return member
    },

    // Find membership by group and user
    async findByGroupAndUser(data: GroupAndUserInput): Promise<GroupMember | undefined> {
        const [member] = await db
            .select()
            .from(groupMembers)
            .where(
                and(
                    eq(groupMembers.groupId, data.groupId),
                    eq(groupMembers.userId, data.userId)
                )
            )
        return member
    },

    // List group members with user info, with optional filters
    async listByGroup(data: ListMembersByGroupInput): Promise<GroupMemberWithUser[]> {
        const { groupId, status, role, limit, offset } = data

        return db.query.groupMembers.findMany({
            where: buildWhereClause({ groupId, status, role }),
            with: {
                user: {
                    columns: { id: true, name: true, email: true },
                },
            },
            orderBy: [
                asc(groupMembers.role), // Admins first
                asc(groupMembers.joinedAt)
            ],
            limit,
            offset,
        })
    },

    // List groups the user has joined with optional filters
    async listByUser(data: ListMembersByUserInput): Promise<GroupMemberWithGroup[]> {
        const { userId, status, role, limit, offset } = data

        return db.query.groupMembers.findMany({
            where: buildWhereClause({ userId, status, role }),
            with: {
                group: {
                    with: {
                        creator: {
                            columns: { id: true, name: true, email: true },
                        },
                    },
                },
            },
            orderBy: [desc(groupMembers.joinedAt)],
            limit,
            offset,
        })
    },

    // Count group members by group ID with optional filters
    async countByGroup(data: CountMembersByGroupInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(buildWhereClause(data))

        return result?.value ?? 0
    },

    // Count groups I've joined by user ID with optional filters
    async countByUser(data: CountMembersByUserInput): Promise<number> {
        const { userId, status, role } = data

        const [result] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(buildWhereClause({ userId, status, role }))

        return result?.value ?? 0
    },

    // Check if user is group admin/member
    async checkRole(data: CheckRoleInput): Promise<boolean> {
        const [member] = await db
            .select()
            .from(groupMembers)
            .where(
                buildWhereClause({ ...data, status: GROUP_MEMBER_STATUS.APPROVED })
            )
            .limit(1)

        return !!member
    }
}