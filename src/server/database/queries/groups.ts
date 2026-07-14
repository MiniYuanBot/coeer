// groupQueries.ts
import { db } from '../client'
import { groups } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, SQL } from 'drizzle-orm'
import type { NewGroup, Group } from '../schemas'
import {
    UpdateGroupInput,
    GroupFilterInput,
    GroupIdInput,
    GroupWithCreator,
    GroupWithStats,
    ListAllGroupsInput,
    UpdateGroupStatusInput,
    GroupIdWithFilterInput,
    GroupSlugWithFilterInput
} from '@shared/contracts'
import { GroupCategory, GROUP_STATUS, GroupStatus } from '@shared/constants'
import { groupMemberQueries } from './groupMembers'

// Private query condition builder
function buildWhereClause(params: {
    groupId?: string
    slug?: string
    status?: GroupStatus | GroupStatus[]
    category?: GroupCategory
    search?: string
}): SQL | undefined {
    const { groupId, slug, status, category, search } = params
    const conditions: SQL[] = []

    if (groupId) {
        conditions.push(eq(groups.id, groupId))
    }

    if (slug) {
        conditions.push(eq(groups.slug, slug))
    }

    if (status) {
        if (Array.isArray(status)) {
            conditions.push(inArray(groups.status, status))
        } else {
            conditions.push(eq(groups.status, status))
        }
    }

    if (category) {
        conditions.push(eq(groups.category, category))
    }

    if (search) {
        const searchCondition = or(
            ilike(groups.name, `%${search}%`),
            ilike(groups.description, `%${search}%`),
            ilike(groups.slug, `%${search}%`)
        )
        if (searchCondition) {
            conditions.push(searchCondition)
        }
    }

    return conditions.length > 0 ? and(...conditions) : undefined
}

export const groupQueries = {
    // Create a group
    async create(data: NewGroup): Promise<Group> {
        const [group] = await db.insert(groups).values(data).returning()
        return group
    },

    // Update group info
    async update(data: UpdateGroupInput): Promise<void> {
        await db.update(groups)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(groups.id, data.id))
    },

    // Delete a group
    async delete(data: GroupIdInput): Promise<void> {
        await db.delete(groups).where(eq(groups.id, data.groupId))
    },

    // Find a group by its ID with optional filters
    async findById(data: GroupIdWithFilterInput): Promise<Group | undefined> {
        const [group] = await db.select().from(groups).where(buildWhereClause(data))
        return group
    },

    // Find a group by its slug with optional filters
    async findBySlug(data: GroupSlugWithFilterInput): Promise<GroupWithStats | undefined> {
        const group = await db.query.groups.findFirst({
            where: buildWhereClause(data),
            with: {
                creator: {
                    columns: { id: true, name: true, email: true },
                },
            },
        })

        if (!group) return undefined

        // Get member count
        const memberCount = await groupMemberQueries.countByGroup({ groupId: group.id })

        // Get posts count
        const postCount = await this.getPostCount({ groupId: group.id })

        return {
            ...group,
            memberCount: memberCount,
            postCount: postCount,
        }
    },

    // Count groups with filters
    async countGroups(data: GroupFilterInput): Promise<number> {
        const [result] = await db
            .select({ value: count() })
            .from(groups)
            .where(buildWhereClause(data))

        return result?.value ?? 0
    },

    // Get group's post count
    async getPostCount(data: GroupIdInput): Promise<number> {
        return 0
    },

    // Review group (approve/reject)
    async updateStatus(data: UpdateGroupStatusInput): Promise<void> {
        await db.update(groups)
            .set({
                status: data.status,
                rejectedReason: data.status === GROUP_STATUS.REJECTED ? data.rejectedReason : null,
                reviewNote: data.reviewNote,
                // reviewedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(groups.id, data.id))
    },

    // List all groups with optional filters
    async listAll(data: ListAllGroupsInput): Promise<GroupWithCreator[]> {
        const { status, category, search, limit, offset } = data

        return db.query.groups.findMany({
            where: buildWhereClause({ status, category, search }),
            with: {
                creator: {
                    columns: { id: true, name: true, email: true },
                },
            },
            orderBy: [desc(groups.createdAt)],
            limit,
            offset,
        })
    },

    // // List groups created by a specific user
    // async listByCreator(
    //     creatorId: string,
    //     params: {
    //         status?: GroupStatus
    //         limit?: number
    //         offset?: number
    //     }
    // ): Promise<Group[]> {
    //     const { status, limit = 20, offset = 0 } = params
    //     const conditions: SQL[] = [eq(groups.creatorId, creatorId)]

    //     if (status) {
    //         conditions.push(eq(groups.status, status))
    //     }

    //     return db.query.groups.findMany({
    //         where: and(...conditions),
    //         orderBy: [desc(groups.createdAt)],
    //         limit,
    //         offset,
    //     })
    // },

    // // List pending groups for admin review
    // async listPending(data: ListPendingGroupsInput): Promise<GroupWithCreator[]> {
    //     const { limit, offset } = data

    //     return db.query.groups.findMany({
    //         where: eq(groups.status, GROUP_STATUS.PENDING),
    //         with: {
    //             creator: {
    //                 columns: { id: true, name: true, email: true },
    //             },
    //         },
    //         orderBy: [asc(groups.createdAt)],
    //         limit,
    //         offset,
    //     })
    // },
}
