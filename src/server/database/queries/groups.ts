// groupQueries.ts
import { db } from '../client'
import { groups, users, groupMembers } from '../schemas'
import { eq, desc, and, inArray, ilike, or, count, asc, SQL, isNotNull } from 'drizzle-orm'
import type { NewGroup, Group } from '../schemas'
import { GroupWithCreator, GroupWithStats } from '@shared/contracts'
import { GroupCategory, GROUP_STATUS, GroupStatus } from '@shared/constants'

// Private query condition builder
function buildWhereClause(params: {
    id?: string
    slug?: string
    status?: GroupStatus | GroupStatus[]
    category?: GroupCategory
    search?: string
}): SQL | undefined {
    const { id, slug, status, category, search } = params
    const conditions: SQL[] = []

    if (id) {
        conditions.push(eq(groups.id, id))
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
    async update(id: string, data: Partial<NewGroup>): Promise<void> {
        await db.update(groups)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(groups.id, id))
    },

    // Delete a group
    async delete(id: string): Promise<void> {
        await db.delete(groups).where(eq(groups.id, id))
    },

    // Find a group by its ID
    async findById(id: string): Promise<Group | undefined> {
        const [group] = await db.select().from(groups).where(eq(groups.id, id))
        return group
    },

    // Get group's member count
    async getMemberCount(id: string): Promise<number> {
        const [memberCountResult] = await db
            .select({ value: count() })
            .from(groupMembers)
            .where(
                and(
                    eq(groupMembers.groupId, id),
                    eq(groupMembers.status, GROUP_STATUS.APPROVED)
                )
            )

        return memberCountResult?.value ?? 0
    },
    
    // Get group's post count
    async getPostCount(id: string): Promise<number> {
        return 0
    },

    // Find a group by its slug
    async findBySlug(slug: string): Promise<GroupWithStats | undefined> {
        const group = await db.query.groups.findFirst({
            where: and(
                eq(groups.slug, slug),
                eq(groups.status, GROUP_STATUS.APPROVED)
            ),
            with: {
                creator: {
                    columns: { id: true, name: true, email: true },
                },
            },
        })

        if (!group) return undefined

        // Get member count
        const memberCount = await this.getMemberCount(group.id)

        // Get posts count
        const postCount = await this.getPostCount(group.id)

        return {
            ...group,
            memberCount: memberCount,
            postCount: postCount,
        }
    },

    // Review group (approve/reject)
    async updateStatus(
        id: string,
        status: GroupStatus,
        rejectedReason?: string
    ): Promise<void> {
        await db.update(groups)
            .set({
                status,
                rejectedReason: status === GROUP_STATUS.REJECTED ? rejectedReason : null,
                // reviewedAt: new Date(),
                updatedAt: new Date()
            })
            .where(eq(groups.id, id))
    },

    // List public approved groups
    async listApproved(params: {
        category?: GroupCategory
        search?: string
        limit?: number
        offset?: number
    }): Promise<GroupWithCreator[]> {
        const { category, search, limit = 20, offset = 0 } = params

        return db.query.groups.findMany({
            where: buildWhereClause({
                status: GROUP_STATUS.APPROVED,
                category,
                search
            }),
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

    // List pending groups for admin review
    async listPending(params: {
        limit?: number
        offset?: number
    }): Promise<GroupWithCreator[]> {
        const { limit = 20, offset = 0 } = params

        return db.query.groups.findMany({
            where: eq(groups.status, GROUP_STATUS.PENDING),
            with: {
                creator: {
                    columns: { id: true, name: true, email: true },
                },
            },
            orderBy: [asc(groups.createdAt)],
            limit,
            offset,
        })
    },

    // Count groups with filters
    async count(params: {
        status?: GroupStatus
        category?: GroupCategory
        search?: string
    }): Promise<number> {
        const whereClause = buildWhereClause(params)

        const [result] = await db
            .select({ value: count() })
            .from(groups)
            .where(whereClause)

        return result?.value ?? 0
    }
}