// groupMemberQueries.ts
import { db } from '../client'
import { groupMembers } from '../schemas'
import { eq, desc, and, inArray, count, asc, SQL } from 'drizzle-orm'
import type { NewGroupMember, GroupMember } from '../schemas'
import { GroupMemberWithUser, GroupMemberWithGroup } from '@shared/contracts'
import { GroupMemberRoles, GroupMemberStatuses, GROUP_MEMBER_STATUSES, GROUP_MEMBER_ROLES } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    groupId?: string
    userId?: string
    status?: GroupMemberStatuses | GroupMemberStatuses[]
    role?: GroupMemberRoles
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

    // Remove member / leave group
    async delete(id: string): Promise<void> {
        await db.delete(groupMembers).where(eq(groupMembers.id, id))
    },

    // Find a membership by its id
    async findById(id: string): Promise<GroupMember | undefined> {
        const [member] = await db.select().from(groupMembers).where(eq(groupMembers.id, id))
        return member
    },

    // Find membership by group and user
    async findByGroupAndUser(groupId: string, userId: string): Promise<GroupMember | undefined> {
        const [member] = await db
            .select()
            .from(groupMembers)
            .where(
                and(
                    eq(groupMembers.groupId, groupId),
                    eq(groupMembers.userId, userId)
                )
            )
        return member
    },

    // List group members with user info, with optional filters
    async findMembersByGroup(
        groupId: string,
        params: {
            status?: GroupMemberStatuses
            role?: GroupMemberRoles
            limit?: number
            offset?: number
        }
    ): Promise<GroupMemberWithUser[]> {
        const { status, role, limit = 50, offset = 0 } = params

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

    // List groups a user has joined with optional filters
    async findGroupsByUser(
        userId: string,
        params: {
            status?: GroupMemberStatuses
            limit?: number
            offset?: number
        }
    ): Promise<GroupMemberWithGroup[]> {
        const { status = GROUP_MEMBER_STATUSES.APPROVED, limit = 20, offset = 0 } = params

        return db.query.groupMembers.findMany({
            where: buildWhereClause({ userId, status }),
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

    // Update member role
    async updateRole(id: string, role: GroupMemberRoles): Promise<void> {
        await db.update(groupMembers)
            .set({ role, updatedAt: new Date() })
            .where(eq(groupMembers.id, id))
    },

    // Update member status (approve/reject join request)
    async updateStatus(id: string, status: GroupMemberStatuses): Promise<void> {
        await db.update(groupMembers)
            .set({
                status,
                joinedAt: status === GROUP_MEMBER_STATUSES.APPROVED ? new Date() : undefined,
                updatedAt: new Date()
            })
            .where(eq(groupMembers.id, id))
    },

    // Count group members by group ID with optional filters
    async countByGroup(groupId: string, params: {
        status?: GroupMemberStatuses
        role?: GroupMemberRoles
    }): Promise<number> {
        const { status, role } = params

        const [result] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(buildWhereClause({ groupId, status, role }))

        return result?.value ?? 0
    },

    // Count groups I've joined by user ID with optional filters
    async countByUser(userId: string, params: {
        status?: GroupMemberStatuses
        role?: GroupMemberRoles
    }): Promise<number> {
        const { status, role } = params

        const [result] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(buildWhereClause({ userId, status, role }))

        return result?.value ?? 0
    },

    // Check if user is group admin/member
    async isRole(groupId: string, userId: string, role: GroupMemberRoles): Promise<boolean> {
        const [member] = await db
            .select()
            .from(groupMembers)
            .where(
                buildWhereClause({ groupId, userId, status: GROUP_MEMBER_STATUSES.APPROVED, role: role })
            )
            .limit(1)

        return !!member
    }
}